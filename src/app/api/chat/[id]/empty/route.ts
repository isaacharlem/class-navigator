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
    console.log(`[EMPTY CHAT CHECK] Checking if chat ${id} is empty and should be deleted`);
    
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.log(`[EMPTY CHAT CHECK] Not authenticated for chat ${id}`);
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
        course: {
          select: {
            name: true,
          }
        }
      },
    });

    if (!chat) {
      console.log(`[EMPTY CHAT CHECK] Chat ${id} not found`);
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    console.log(`[EMPTY CHAT CHECK] Chat ${id} (${chat.title}) for course ${chat.course.name} has ${chat._count.messages} messages (type: ${chat.type})`);

    // Only delete the chat if it has no messages
    if (chat._count.messages === 0) {
      // Delete the chat
      console.log(`[EMPTY CHAT CHECK] Deleting empty chat ${id} (${chat.title})`);
      await prisma.chat.delete({
        where: {
          id,
        },
      });
      return NextResponse.json({ 
        success: true, 
        deleted: true,
        chatType: chat.type,
        chatTitle: chat.title 
      });
    }

    // If chat has messages, don't delete it
    console.log(`[EMPTY CHAT CHECK] Chat ${id} has ${chat._count.messages} messages, not deleting`);
    return NextResponse.json({ 
      success: true, 
      deleted: false,
      chatType: chat.type,
      chatTitle: chat.title
    });
  } catch (error) {
    console.error("[EMPTY CHAT CHECK] Failed to check/delete empty chat:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
