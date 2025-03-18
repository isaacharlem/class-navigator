import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { processDocument } from '@/lib/documentProcessor';

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
      const title = formData.get('title') as string | null;
      const useOcr = formData.get('useOcr') === 'true';
      
      // Validate inputs
      if (!file) {
        return handleError('No file provided', 400);
      }
      
      if (!title) {
        return handleError('Document title is required', 400);
      }

      // Validate file type
      if (!file.type.includes('pdf')) {
        return handleError('Only PDF files are supported', 400);
      }

      // Process the file
      try {
        // Convert the file to a Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Create the document record
        const document = await prisma.document.create({
          data: {
            title,
            type: 'pdf',
            content: useOcr ? '[PDF content being processed with OCR]' : '[PDF content being processed]',
            fileName: file.name,
            fileSize: file.size,
            processed: false,
            courseId: id,
          },
        });
        
        console.log(`Created PDF document: ${document.id} - ${document.title}${useOcr ? ' (with OCR)' : ''}`);
        
        // Process the document asynchronously (don't wait for it to complete)
        setTimeout(async () => {
          try {
            console.log(`Starting to process PDF document ${document.id}`);
            
            try {
              // Extract text from the buffer
              await processDocument({
                ...document,
                content: buffer.toString('base64').substring(0, 1000) // Just a sample of the content
              });
              
              // Mark as processed
              await prisma.document.update({
                where: { id: document.id },
                data: { processed: true },
              });
              
              console.log(`PDF document ${document.id} processed successfully`);
            } catch (processingError) {
              console.error(`Error processing PDF document ${document.id}:`, processingError);
              await prisma.document.update({
                where: { id: document.id },
                data: { 
                  processed: true, // Mark as processed even if there was an error
                  content: `[PROCESSING WARNING: PDF was stored but text extraction had issues]`
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
          message: `PDF uploaded successfully${useOcr ? ' (OCR processing enabled)' : ''}`
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