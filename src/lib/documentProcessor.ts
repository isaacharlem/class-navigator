import { PrismaClient } from '@prisma/client';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';
import { createCanvas } from 'canvas';

// Set the PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Simple import for pdf-parse
const pdfParse = require('pdf-parse');

// Initialize OpenAI client for Vision API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define interface matching our Prisma Document model
interface DocumentModel {
  id: string;
  type: 'text' | 'url' | 'pdf';
  title: string;
  content?: string | null;
  url?: string | null;
  processed: boolean;
  courseId: string;
  fileName?: string | null;
  fileSize?: number | null;
}

const prisma = new PrismaClient();

/**
 * Process a document and generate embeddings for its content
 */
export async function processDocument(document: DocumentModel): Promise<void> {
  try {
    // Step 1: Extract text based on document type
    const text = await extractText(document);
    if (!text) return;

    // Step 2: Split text into chunks
    const chunks = await splitIntoChunks(text);

    // Step 3: Generate embeddings for each chunk
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Step 4: Store each chunk and its embedding in the database
    for (const chunk of chunks) {
      try {
        const embeddingVector = await embeddings.embedQuery(chunk);
        
        // Store as a string since SQLite doesn't support array types
        const embeddingString = JSON.stringify(embeddingVector);
        
        await prisma.vectorStore.create({
          data: {
            documentId: document.id,
            chunk,
            embedding: embeddingString,
          },
        });
      } catch (error) {
        console.error('Error generating embedding for chunk:', error);
        // Continue with other chunks if one fails
      }
    }

    // Update document status to processed
    await prisma.document.update({
      where: { id: document.id },
      data: { processed: true },
    });

  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

/**
 * Extract text from a document based on its type
 */
async function extractText(document: DocumentModel): Promise<string | null> {
  switch (document.type) {
    case 'text':
      return document.content || '';
      
    case 'url':
      if (!document.url) return null;
      return await extractTextFromUrl(document.url);
      
    case 'pdf':
      // Use the content if it's already available
      if (document.content) {
        return document.content;
      } else if (document.url) {
        try {
          // If the document has a URL that points to a PDF, download it and extract text
          const response = await axios.get(document.url, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(response.data);
          
          return await extractTextFromPdfBuffer(buffer);
        } catch (error) {
          console.error('Error downloading PDF from URL:', error);
          return `[Failed to download PDF]`;
        }
      }
      
      // For uploaded PDFs that don't have content yet,
      // we'd normally load from storage. For this example, we'll return
      // a placeholder as we can't access the file directly
      return `[PDF Content from ${document.fileName || 'uploaded file'}]`;
      
    default:
      return document.content || '';
  }
}

/**
 * Extract text from a PDF buffer
 * First tries PDF parsing, falls back to OpenAI Vision API if needed
 */
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // First, try standard PDF text extraction
    try {
      const pdfData = await pdfParse(buffer);
      const extractedText = pdfData.text || '';
      
      // If we got meaningful text content, return it
      if (extractedText.trim().length > 50) {
        console.log('Successfully extracted text from PDF using pdf-parse');
        return extractedText;
      }
      
      console.log('PDF text extraction yielded minimal content, trying OpenAI Vision API...');
    } catch (pdfError) {
      console.error('Error parsing PDF with pdf-parse:', pdfError);
      console.log('Falling back to OpenAI Vision API...');
    }
    
    // If standard extraction failed or returned minimal content, try OCR with OpenAI
    return await performOCRWithOpenAI(buffer);
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '[Failed to extract text from PDF]';
  }
}

/**
 * Convert PDF buffer to an array of image buffers (one per page)
 */
async function convertPdfToImages(pdfBuffer: Buffer): Promise<string[]> {
  try {
    console.log('Converting PDF to images...');
    
    // Load the PDF
    const data = new Uint8Array(pdfBuffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const numPages = pdf.numPages;
    console.log(`PDF has ${numPages} pages`);
    
    // Process all pages
    const base64Images: string[] = [];
    
    // Convert each page to an image
    for (let i = 1; i <= numPages; i++) {
      console.log(`Converting page ${i}/${numPages} to image...`);
      const page = await pdf.getPage(i);
      
      // Set scale for good resolution but not too large
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      // Create canvas to render the page
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Prepare canvas for rendering
      // Using any type to bypass the type mismatch between node-canvas and PDF.js
      const renderContext = {
        canvasContext: context as any,
        viewport: viewport,
      };
      
      // Render the page
      await page.render(renderContext).promise;
      
      // Convert canvas to base64 image
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      base64Images.push(imageData);
      
      // Log progress for long PDFs
      if (numPages > 10 && i % 5 === 0) {
        console.log(`Progress: ${i}/${numPages} pages converted`);
      }
    }
    
    console.log(`Successfully converted ${base64Images.length} PDF pages to images`);
    return base64Images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
}

/**
 * Perform OCR on a PDF buffer using OpenAI's Vision API
 * Includes PDF to image conversion for all pages
 */
async function performOCRWithOpenAI(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting OCR process with OpenAI Vision API...');
    
    // Step 1: Convert PDF to images
    const images = await convertPdfToImages(buffer);
    if (images.length === 0) {
      throw new Error('Failed to convert PDF to images');
    }
    
    console.log(`Processing ${images.length} pages with OpenAI Vision API`);
    
    // Step 2: Process each image with OpenAI Vision API and combine results
    let fullText = '';
    
    // Process images in batches to avoid overloading the API
    const batchSize = 5;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      const batchPromises = batch.map(async (imageData, index) => {
        const pageNumber = i + index + 1;
        console.log(`Processing page ${pageNumber}/${images.length} with OpenAI Vision...`);
        
        try {
          // Call OpenAI Vision API
          const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: `Extract all text from this document image (page ${pageNumber}/${images.length}). Format it as plain text and preserve paragraph structure.` 
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: imageData,
                    },
                  }
                ],
              },
            ],
            max_tokens: 4096,
          });
          
          // Extract text from the response
          const pageText = response.choices[0]?.message?.content || '';
          return { pageNumber, text: pageText };
        } catch (error) {
          console.error(`Error processing page ${pageNumber}:`, error);
          return { pageNumber, text: `[Error extracting text from page ${pageNumber}]` };
        }
      });
      
      // Wait for all pages in batch to be processed
      const batchResults = await Promise.all(batchPromises);
      
      // Sort results by page number and add to full text
      batchResults
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .forEach(result => {
          if (result.text.trim()) {
            if (fullText) fullText += '\n\n--- Page Break ---\n\n';
            fullText += result.text;
          }
        });
      
      // Log progress for large PDFs
      if (images.length > batchSize) {
        console.log(`Processed ${Math.min(i + batchSize, images.length)}/${images.length} pages`);
      }
    }
    
    console.log('OpenAI OCR processing complete');
    return fullText || '[No text detected via OpenAI OCR]';
  } catch (error: unknown) {
    console.error('Error performing OCR with OpenAI:', error);
    
    // Check if it's a file format error
    if (error instanceof Error && (
        error.message?.includes('format') || 
        error.message?.includes('unsupported') ||
        error.message?.includes('Invalid file format'))) {
      console.log('Error with PDF format or conversion');
      return '[Error processing PDF: Format issues detected]';
    }
    
    // Check if it's an API limit error
    if (error instanceof Error && error.message?.includes('rate limit')) {
      return '[OpenAI API rate limit exceeded. Please try again later or process a smaller document.]';
    }
    
    return '[OpenAI OCR processing failed. Error: ' + (error instanceof Error ? error.message : 'Unknown error') + ']';
  }
}

/**
 * Extract text from a URL by scraping the page content
 */
async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Extract text from the page
    const text = $('body').text();
    
    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  } catch (error) {
    console.error('Error extracting text from URL:', error);
    return '';
  }
}

/**
 * Split text into chunks for embedding
 */
async function splitIntoChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const output = await splitter.createDocuments([text]);
  return output.map(doc => doc.pageContent);
} 