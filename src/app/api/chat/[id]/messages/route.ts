import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

interface Citation {
  id: string;
  messageId: string;
  documentId: string;
  sourceText: string;
  createdAt: Date;
}

interface MessageWithCitations {
  id: string;
  content: string;
  role: string;
  chatId: string;
  createdAt: Date;
  citations: Citation[];
}

// GET /api/chat/[id]/messages - Get all messages for a chat
export async function GET(req: Request, context: { params: { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the chat exists and belongs to the user
    const chat = await prisma.chat.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get all messages for the chat
    const messages = await prisma.message.findMany({
      where: {
        chatId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        citations: true,
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
