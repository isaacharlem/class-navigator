import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// GET /api/documents/[id] - Get document details
export async function GET(
  req: Request,
  context: { params: { id: string } },
) {
  try {
    const params = await context.params;
    const { id } = params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Check if the user has access to this document
    if (document.course.userId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Return document details (excluding sensitive information)
    return NextResponse.json({
      id: document.id,
      title: document.title,
      type: document.type,
      content: document.content,
      url: document.url,
      processed: document.processed,
      createdAt: document.createdAt,
      fileName: document.fileName,
    });
  } catch (error) {
    console.error("Failed to retrieve document:", error);
    return NextResponse.json(
      { error: "Failed to retrieve document" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/documents/[id] - Delete a document
export async function DELETE(
  req: Request,
  context: { params: { id: string } },
) {
  try {
    const params = await context.params;
    const { id } = params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // Check if the user has access to this document
    if (document.course.userId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Delete all vector store entries for this document first
    await prisma.vectorStore.deleteMany({
      where: { documentId: id },
    });

    // Delete the document
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
