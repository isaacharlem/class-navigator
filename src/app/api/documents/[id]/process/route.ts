import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { processDocument } from '@/lib/documentProcessor';

const prisma = new PrismaClient();

// POST /api/documents/[id]/process - Process a document
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if the user has access to this document
    if (document.course.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if already processed
    if (document.processed) {
      return NextResponse.json({ 
        message: 'Document already processed',
        processed: true
      });
    }

    // Process the document (this will generate embeddings)
    await processDocument(document);

    return NextResponse.json({ 
      message: 'Document processed successfully',
      processed: true
    });
  } catch (error) {
    console.error('Failed to process document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 