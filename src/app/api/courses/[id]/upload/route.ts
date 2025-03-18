import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { processDocument } from '@/lib/documentProcessor';
import { cancelAllActiveRuns } from '@/lib/assistantService';

const prisma = new PrismaClient();

// POST /api/courses/[id]/upload - Upload a PDF file for a course
export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    // Ensure we always return JSON even in error cases
    const handleError = (message: string, status: number = 500) => {
      console.error(`Upload error: ${message}`);
      return NextResponse.json({ error: message }, { status });
    };

    try {
      const params = await context.params;
      const id = params.id;
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return handleError('You must be signed in to access this endpoint', 401);
      }
      
      // Verify the course exists and belongs to the user
      const course = await prisma.course.findFirst({
        where: {
          id,
          userId: session.user.id,
        },
      });

      if (!course) {
        return handleError('Course not found', 404);
      }

      // Parse the FormData safely
      let formData;
      try {
        formData = await req.formData();
      } catch (formError) {
        return handleError('Failed to parse form data. Ensure you are sending a proper FormData object.', 400);
      }

      const file = formData.get('file') as File | null;
      let title = formData.get('title') as string | null;
      
      console.log('FormData entries:', {
        file: file ? { name: file.name, type: file.type, size: file.size } : null,
        title: title
      });
      
      // Validate inputs
      if (!file) {
        return handleError('No file provided', 400);
      }
      
      // Ensure title is properly defined and not whitespace
      if (!title || title.trim() === '') {
        return handleError('Document title is required', 400);
      }
      
      // Trim the title
      title = title.trim();

      // Validate file type - more comprehensive check
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        return handleError('Only PDF files are supported', 400);
      }

      // Process the file
      try {
        // Convert the file to a Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Ensure we have a valid buffer
        if (!buffer || buffer.length === 0) {
          return handleError('Invalid PDF file: Empty file or conversion failed', 400);
        }
        
        // Create the document record
        const document = await prisma.document.create({
          data: {
            title,
            type: 'pdf',
            content: '[PDF content being processed with OpenAI Assistant API]',
            fileName: file.name,
            fileSize: file.size,
            processed: false,
            courseId: id,
          },
        });
        
        console.log(`Created PDF document: ${document.id} - ${document.title} (with OpenAI Assistant API)`);
        
        // Process the document asynchronously (don't wait for it to complete)
        setTimeout(async () => {
          try {
            console.log(`Starting to process PDF document ${document.id} with OpenAI Assistant API`);
            
            try {
              // Process the document with the full buffer
              await processDocument({
                ...document,
                _buffer: buffer // Pass the buffer directly for processing
              } as any);
              
              // Mark as processed
              await prisma.document.update({
                where: { id: document.id },
                data: { processed: true },
              });
              
              console.log(`PDF document ${document.id} processed successfully with OpenAI Assistant API`);
            } catch (processingError) {
              console.error(`Error processing PDF document ${document.id}:`, processingError);
              
              // Get error message
              const errorMessage = processingError instanceof Error 
                ? processingError.message 
                : 'Unknown error during PDF processing';
              
              // Save the extracted text we have if possible, otherwise store error
              let errorContent = `[PROCESSING ERROR: ${errorMessage}]`;
              
              // Provide more specific error message for different types of errors
              if (errorMessage.includes('worker') || errorMessage.includes('GlobalWorkerOptions')) {
                errorContent = 'PDF processing encountered a configuration issue with the PDF.js library. The system administrator has been notified and is working to fix this issue.';
              } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
                errorContent = 'PDF processing has been rate-limited by our AI provider. Please try again later.';
              } else if (errorMessage.includes('format') || errorMessage.includes('invalid')) {
                errorContent = 'The PDF file appears to be corrupted or in an unsupported format. Please check the file and try uploading again.';
              }
              
              await prisma.document.update({
                where: { id: document.id },
                data: { 
                  processed: true, // Mark as processed even if there was an error
                  content: errorContent
                },
              });
            }
          } catch (error) {
            console.error(`Async processing error for document ${document.id}:`, error);
          } finally {
            await prisma.$disconnect();
          }
        }, 100);
        
        // Return success immediately, don't wait for processing
        return NextResponse.json({ 
          id: document.id, 
          title: document.title,
          message: `PDF uploaded successfully (OCR processing enabled)`
        });
        
      } catch (error) {
        return handleError('Failed to process PDF file', 500);
      }
    } catch (error) {
      return handleError('Failed to upload document', 500);
    }
  } catch (finalError) {
    // This is our last line of defense against uncaught errors
    console.error('Critical error in upload route:', finalError);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request' },
      { status: 500 }
    );
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
}

// Add error handler to cleanup OpenAI threads
process.on('SIGINT', async () => {
  console.log('Shutting down, cleaning up active PDF processing runs...');
  try {
    await cancelAllActiveRuns();
    console.log('Cleanup complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
});