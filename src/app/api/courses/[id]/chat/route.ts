import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { ChatOpenAI } from "@langchain/openai";
import { authOptions } from "../../../auth/[...nextauth]/route";
import OpenAI from "openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate a title for a chat based on the first message
async function generateChatTitle(
  message: string,
  courseName: string,
): Promise<string> {
  try {
    const chatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    const response = await chatModel.invoke([
      [
        "system",
        `You are a helpful assistant that generates concise, descriptive titles for chat conversations.
        The title should be 3-6 words and reflect the topic or question being discussed.`,
      ],
      [
        "user",
        `Generate a short, descriptive title for a chat about "${courseName}" that starts with this message: "${message}"`,
      ],
    ]);

    let title = response.content.toString().trim();

    // Remove quotes if present
    title = title.replace(/^["'](.*)["']$/, "$1");

    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + "...";
    }

    return title;
  } catch (error) {
    console.error("Error generating chat title:", error);
    return `Chat about ${courseName}`;
  }
}

// POST /api/courses/[id]/chat - Create a new chat for a course
export async function POST(req: Request, context: { params: { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      type = "general",
      assignmentName = null,
      firstMessage = null,
      forceNew = false,
    } = body;

    // Verify the course exists and belongs to the user
    const course = await prisma.course.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let chatTitle = title;
    let chat;

    // If type is general and not forcing new, look for existing general chat first
    if (type === "general" && !forceNew) {
      // First check if there's already a general chat
      const existingChat = await prisma.chat.findFirst({
        where: {
          courseId: id,
          userId: session.user.id,
          type: "general",
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

      if (existingChat) {
        return NextResponse.json(existingChat);
      }
    }

    // If a title is provided and not forcing new, check if a chat with that title already exists
    if (chatTitle && !forceNew) {
      const existingChat = await prisma.chat.findFirst({
        where: {
          courseId: id,
          userId: session.user.id,
          title: chatTitle,
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

      if (existingChat) {
        return NextResponse.json(existingChat);
      }
    }
    // If no title is provided
    else {
      if (type === "general") {
        // Use a temporary title for general chats until the first message is sent
        if (firstMessage) {
          chatTitle = await generateChatTitle(firstMessage, course.name);
        } else {
          chatTitle = `General Chat - ${course.name}`;
        }
      } else if (firstMessage) {
        // For assignment chats, generate title from first message if available
        chatTitle = await generateChatTitle(
          firstMessage,
          assignmentName ? `${course.name} (${assignmentName})` : course.name,
        );
      } else {
        // For assignment chats without a first message
        if (!assignmentName) {
          return NextResponse.json(
            { error: "Title or assignment name is required" },
            { status: 400 },
          );
        }
        chatTitle = `Assignment: ${assignmentName}`;
      }
    }

    // Create the chat
    chat = await prisma.chat.create({
      data: {
        title: chatTitle,
        type,
        assignmentName: type === "assignment" ? assignmentName : null,
        courseId: id,
        userId: session.user.id,
      },
      include: {
        course: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // If a first message was provided, create it
    if (firstMessage && firstMessage.trim() !== "") {
      const userMsg = await prisma.message.create({
        data: {
          content: firstMessage,
          role: "user",
          chatId: chat.id,
        },
      });

      // Automatically generate an AI response to the first message
      try {
        const systemMessage = `You are a helpful assistant for a course titled "${chat.course.name}".
          Provide relevant information and assistance related to the course content and topics.`;

        // Call the OpenAI API
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: firstMessage },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        // Save the AI response
        const assistantContent = response.choices[0].message.content || "";
        await prisma.message.create({
          data: {
            content: assistantContent,
            role: "assistant",
            chatId: chat.id,
          },
        });
      } catch (error) {
        console.error("Failed to generate AI response:", error);
        // Continue even if AI response fails - user can retry later
      }
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/courses/[id]/chat - Get all chats for a course
export async function GET(req: Request, context: { params: { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the course exists and belongs to the user
    const course = await prisma.course.findFirst({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get all chats for the course
    const chats = await prisma.chat.findMany({
      where: {
        courseId: id,
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
