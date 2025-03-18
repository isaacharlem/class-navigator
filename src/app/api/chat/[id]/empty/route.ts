import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// DELETE /api/chat/[id]/empty - Delete a chat if it has no messages
export async function DELETE(
  req: Request,
  context: { params: { id: string } },
) {
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
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Only delete the chat if it has no messages
    if (chat._count.messages === 0) {
      // Delete the chat
      await prisma.chat.delete({
        where: {
          id,
        },
      });
      return NextResponse.json({ success: true, deleted: true });
    }

    // If chat has messages, don't delete it
    return NextResponse.json({ success: true, deleted: false });
  } catch (error) {
    console.error("Failed to check/delete empty chat:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
