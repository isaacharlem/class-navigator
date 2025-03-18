import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { processDocument } from '@/lib/documentProcessor';

const prisma = new PrismaClient();

// GET /api/courses/[id]/documents - Get all documents for a course
export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify the course exists and belongs to the user
    const course = await prisma.course.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get all documents for the course
    const documents = await prisma.document.findMany({
      where: {
        courseId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/courses/[id]/documents - Create a new document for a course
export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if this is a JSON request or form data
    const contentType = req.headers.get('content-type') || '';
    let title, type, content, url;

    if (contentType.includes('application/json')) {
      // Parse JSON body
      const body = await req.json();
      // Support both 'title' and 'name' fields for backward compatibility
      title = body.title || body.name;
      type = body.type;
      content = body.content;
      url = body.url;
    } else {
      // This might be a form submission from another part of the app
      // Return a more helpful error message
      return NextResponse.json(
        { error: 'Use the PDF upload endpoint for file uploads' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Document title is required (use "title" field)' },
        { status: 400 }
      );
    }

    // Validate document based on type
    if (type === 'url' && !url) {
      return NextResponse.json(
        { error: 'URL is required for URL document type' },
        { status: 400 }
      );
    }

    if (type === 'text' && !content) {
      return NextResponse.json(
        { error: 'Content is required for text document type' },
        { status: 400 }
      );
    }

    // Verify the course exists and belongs to the user
    const course = await prisma.course.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Create the document
    const document = await prisma.document.create({
      data: {
        title,
        type: type || 'text',
        content: content || null,
        url: url || null,
        processed: false, // Start as not processed
        courseId: id,
      },
    });

    console.log(`Created document: ${document.id} - ${document.title}`);

    // Process the document asynchronously
    // We don't await this to avoid blocking the response
    setTimeout(async () => {
      try {
        console.log(`Starting to process document ${document.id}`);
        await processDocument({
          ...document,
          type: document.type as 'text' | 'url' | 'pdf'
        });
        console.log(`Document ${document.id} processed successfully`);
        
        // Update the document status directly rather than relying on processDocument
        await prisma.document.update({
          where: { id: document.id },
          data: { processed: true },
        });
        
        // Log the count of vector chunks created
        const vectorCount = await prisma.vectorStore.count({
          where: { documentId: document.id }
        });
        console.log(`Created ${vectorCount} vector chunks for document ${document.id}`);
      } catch (error) {
        console.error(`Error processing document ${document.id}:`, error);
        
        // Update document with error status
        await prisma.document.update({
          where: { id: document.id },
          data: { 
            processed: false, 
            content: document.content ? 
              document.content + '\n\n[PROCESSING ERROR: Document could not be fully processed]' : 
              '[PROCESSING ERROR: Document could not be processed]'
          },
        });
      } finally {
        await prisma.$disconnect();
      }
    }, 100);

    return NextResponse.json(document);
  } catch (error) {
    console.error('Failed to create document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 