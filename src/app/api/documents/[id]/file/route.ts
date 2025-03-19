import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";

const prisma = new PrismaClient();

// GET /api/documents/[id]/file - Get the file for a document (for PDFs)
export async function GET(req: Request, context: { params: { id: string } }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "You must be signed in to access this endpoint" },
        { status: 401 },
      );
    }

    // Find the document
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            userId: true,
          },
        },
      },
    });

    // Check if document exists and belongs to the user
    if (!document || document.course.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // If the document is a PDF, we'll try to serve it
    if (document.type === "pdf") {
      // For PDFs with URLs already set, redirect to that URL
      if (document.url) {
        return NextResponse.redirect(document.url);
      }

      // Check if we have a local file stored for this document
      const tempDir = os.tmpdir();
      const pdfFilePath = path.join(
        tempDir,
        `${document.id}-${document.fileName || "document.pdf"}`,
      );

      // If the file exists in the temp directory, serve it
      if (fs.existsSync(pdfFilePath)) {
        const fileBuffer = fs.readFileSync(pdfFilePath);
        const headers = new Headers();
        headers.set("Content-Type", "application/pdf");
        headers.set(
          "Content-Disposition",
          `inline; filename="${document.fileName || "document.pdf"}"`,
        );

        return new NextResponse(fileBuffer, {
          status: 200,
          headers,
        });
      }

      // If we don't have a local file, return an error
      return NextResponse.json(
        {
          error: "PDF file unavailable",
          message:
            "The PDF file is not available for direct download. Please contact support if this issue persists.",
        },
        {
          status: 404,
        },
      );
    }

    // For other document types, return an error
    return NextResponse.json(
      {
        error: "This document type cannot be downloaded directly",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error serving document file:", error);
    return NextResponse.json(
      { error: "An error occurred while retrieving the document file" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
