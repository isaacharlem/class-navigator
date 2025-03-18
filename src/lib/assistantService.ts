import OpenAI from 'openai';
import { DocumentModel } from '@/types/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant configuration
const PDF_ASSISTANT_ID = process.env.OPENAI_PDF_ASSISTANT_ID || ''; // Optional: Use pre-created assistant
const ASSISTANT_MODEL = 'gpt-4o'; // Model to use for the assistant

// Cache for thread management
const activeThreads: Record<string, string> = {};

/**
 * Creates or gets an Assistant for PDF processing
 */
export async function getPdfAssistant() {
  try {
    // Use existing assistant if ID is provided and valid
    if (PDF_ASSISTANT_ID) {
      try {
        const assistant = await openai.beta.assistants.retrieve(PDF_ASSISTANT_ID);
        console.log(`Using existing PDF assistant: ${assistant.id}`);
        return assistant;
      } catch (retrieveError) {
        console.warn(`Could not retrieve assistant with ID ${PDF_ASSISTANT_ID}, creating new one`);
      }
    }

    // Create a new assistant
    console.log('Creating new PDF processing assistant');
    const assistant = await openai.beta.assistants.create({
      name: "PDF Processor",
      description: "Assistant specialized in extracting and processing text from PDFs",
      model: ASSISTANT_MODEL,
      instructions: `You are a PDF processing assistant designed to extract text from PDF documents.
      Your main tasks are:
      1. Extract all text from uploaded PDF files with high accuracy
      2. Maintain the document's structure (paragraphs, sections, tables)
      3. Handle complex formatting, tables, and multi-column layouts
      4. Process mathematical equations, technical diagrams, and special characters
      Always extract text exactly as it appears without summarizing or analyzing the content.`,
      tools: [
        { type: "file_search" }
      ],
    });

    console.log(`Created new PDF assistant with ID: ${assistant.id}`);
    return assistant;
  } catch (error) {
    console.error('Error creating PDF assistant:', error);
    throw new Error('Failed to initialize PDF processing assistant');
  }
}

/**
 * Process a PDF document using OpenAI Assistant API
 */
export async function processPdfWithAssistant(document: DocumentModel): Promise<string> {
  try {
    console.log(`Processing PDF document ${document.id} with OpenAI Assistant API`);
    
    // Get or create PDF assistant
    const assistant = await getPdfAssistant();
    
    if (!assistant) {
      throw new Error('Failed to initialize PDF assistant');
    }
    
    // Create a temporary file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${document.id}-${document.fileName || 'document.pdf'}`);
    
    // Get PDF buffer
    let buffer: Buffer;
    if (document._buffer) {
      buffer = document._buffer;
    } else if (document.url) {
      const response = await fetch(document.url);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`No content source available for document ${document.id}`);
    }
    
    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, buffer);
    
    try {
      // Upload file to OpenAI
      console.log(`Uploading PDF to OpenAI: ${tempFilePath}`);
      const file = await openai.files.create({
        file: fs.createReadStream(tempFilePath),
        purpose: 'assistants',
      });
      
      console.log(`File uploaded with ID: ${file.id}`);
      
      // Create a thread for this document
      const thread = await openai.beta.threads.create();
      console.log(`Created thread: ${thread.id} for document ${document.id}`);
      
      // Store thread ID for later reference
      activeThreads[document.id] = thread.id;
      
      // Add message to thread with file attachment
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: 'Please extract all text from this PDF document. Maintain all formatting, paragraphs, tables, and structure.',
        attachments: [{ 
          file_id: file.id,
          tools: [{ type: "file_search" }]
        }],
      });
      
      // Run the assistant
      console.log('Running assistant to process the PDF...');
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });
      
      // Poll for completion (with timeout)
      const maxWaitTime = 30 * 60 * 1000; // 30 minutes
      const startTime = Date.now();
      let runStatus = await checkRunStatus(thread.id, run.id);
      
      while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && Date.now() - startTime < maxWaitTime) {
        // Wait before checking again (5 seconds)
        await new Promise(resolve => setTimeout(resolve, 5000));
        runStatus = await checkRunStatus(thread.id, run.id);
        console.log(`Processing status: ${runStatus.status}`);
      }
      
      if (runStatus.status !== 'completed') {
        throw new Error(`Assistant processing timed out or failed with status: ${runStatus.status}`);
      }
      
      // Get the messages
      const messages = await openai.beta.threads.messages.list(thread.id);
      
      // Extract assistant's response
      const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
      
      if (assistantMessages.length === 0) {
        throw new Error('No response from assistant');
      }
      
      // Extract text content from the response
      let extractedText = '';
      for (const message of assistantMessages) {
        for (const content of message.content) {
          if (content.type === 'text') {
            extractedText += content.text.value + '\n\n';
          }
        }
      }
      
      if (!extractedText.trim()) {
        throw new Error('Assistant did not return any extracted text');
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
      
      // Clean up
      try {
        // Delete the local temp file
        fs.unlinkSync(tempFilePath);
        
        // Delete the file from OpenAI (optional - can keep it for future reference)
        // await openai.files.del(file.id);
        
        // Remove from active threads
        delete activeThreads[document.id];
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      
      return extractedText.trim();
    } finally {
      // Ensure temp file is deleted even if processing fails
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error('Error processing PDF with assistant:', error);
    throw error;
  }
}

/**
 * Check status of a run
 */
async function checkRunStatus(threadId: string, runId: string) {
  try {
    return await openai.beta.threads.runs.retrieve(threadId, runId);
  } catch (error) {
    console.error('Error checking run status:', error);
    return { status: 'failed' };
  }
}

/**
 * Cancel all active processing runs
 */
export async function cancelAllActiveRuns() {
  try {
    for (const [documentId, threadId] of Object.entries(activeThreads)) {
      try {
        console.log(`Cancelling runs for document ${documentId} on thread ${threadId}`);
        
        // List runs for the thread
        const runs = await openai.beta.threads.runs.list(threadId);
        
        // Cancel any active runs
        for (const run of runs.data) {
          if (['in_progress', 'queued'].includes(run.status)) {
            console.log(`Cancelling run ${run.id}`);
            await openai.beta.threads.runs.cancel(threadId, run.id);
          }
        }
      } catch (error) {
        console.error(`Error cancelling runs for document ${documentId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error cancelling active runs:', error);
  }
} 