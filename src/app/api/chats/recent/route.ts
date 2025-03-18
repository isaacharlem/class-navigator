import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';

import { authOptions } from '../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

// GET /api/chats/recent - Get recent chats for the current user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'You must be signed in to access this endpoint' },
        { status: 401 }
      );
    }

    // Get the URL parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    // Find all courses that belong to the user
    const userCourses = await prisma.course.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    });
    
    const courseIds = userCourses.map((course: { id: string }) => course.id);
    
    if (courseIds.length === 0) {
      return NextResponse.json([]);
    }

    // Find chats for these courses
    const chats = await prisma.chat.findMany({
      where: {
        courseId: {
          in: courseIds,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      include: {
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching chats' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 