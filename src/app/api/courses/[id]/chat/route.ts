import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { authOptions } from '../../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

// Generate a title for a chat based on the first message
async function generateChatTitle(message: string, courseName: string): Promise<string> {
  try {
    const chatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    const response = await chatModel.invoke([
      { 
        role: "system", 
        content: `You are a helpful assistant that generates concise, descriptive titles for chat conversations.
        The title should be 3-6 words and reflect the topic or question being discussed.`
      },
      { 
        role: "user", 
        content: `Generate a short, descriptive title for a chat about "${courseName}" that starts with this message: "${message}"`
      }
    ]);

    let title = response.content.toString().trim();
    
    // Remove quotes if present
    title = title.replace(/^["'](.*)["']$/, '$1');
    
    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title;
  } catch (error) {
    console.error('Error generating chat title:', error);
    return `Chat about ${courseName}`;
  }
}

// POST /api/courses/[id]/chat - Create a new chat for a course
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

    const body = await req.json();
    const { title, type = 'general', assignmentName = null, firstMessage = null } = body;

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

    let chatTitle = title;
    let chat;

    // If no title is provided
    if (!chatTitle) {
      if (type === 'general') {
        // First check if there's already a general chat
        const existingChat = await prisma.chat.findFirst({
          where: {
            courseId: id,
            userId: session.user.id,
            type: 'general',
          },
        });

        if (existingChat) {
          return NextResponse.json(existingChat);
        }

        // Generate title if first message is provided, otherwise use default
        if (firstMessage) {
          chatTitle = await generateChatTitle(firstMessage, course.name);
        } else {
          chatTitle = `General Chat - ${course.name}`;
        }
      } else if (firstMessage) {
        // For assignment chats, generate title from first message if available
        chatTitle = await generateChatTitle(firstMessage, 
          assignmentName ? `${course.name} (${assignmentName})` : course.name);
      } else {
        // For assignment chats without a first message
        if (!assignmentName) {
          return NextResponse.json(
            { error: 'Title or assignment name is required' },
            { status: 400 }
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
        assignmentName: type === 'assignment' ? assignmentName : null,
        courseId: id,
        userId: session.user.id,
      },
      include: {
        course: {
          select: {
            name: true,
          },
        },
      },
    });

    // If a first message was provided, create it
    if (firstMessage && firstMessage.trim() !== '') {
      await prisma.message.create({
        data: {
          content: firstMessage,
          role: 'user',
          chatId: chat.id,
        },
      });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to create chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/courses/[id]/chat - Get all chats for a course
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

    // Get all chats for the course
    const chats = await prisma.chat.findMany({
      where: {
        courseId: id,
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
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
    console.error('Failed to fetch chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 