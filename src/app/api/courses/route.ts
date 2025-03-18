import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../auth/[...nextauth]/route';

const prisma = new PrismaClient();

// GET /api/courses - Get all courses for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const courses = await prisma.course.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            chats: true,
            documents: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/courses - Create a new course
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Course name is required' },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        name,
        description,
        userId: session.user.id,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error('Failed to create course:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 