import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

// GET /api/courses/[id] - Get a specific course
export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    // The correct way to access params in Next.js 15
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'You must be signed in to access this endpoint' },
        { status: 401 }
      );
    }

    const course = await prisma.course.findUnique({
      where: {
        id,
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
    });

    if (!course) {
      return NextResponse.json(
        { error: 'Course not found or you do not have access to it' },
        { status: 404 }
      );
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching the course' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/courses/[id] - Update a specific course
export async function PATCH(
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

    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Course name is required' },
        { status: 400 }
      );
    }

    // Check if the course exists and belongs to the user
    const existingCourse = await prisma.course.findUnique({
      where: {
        id,
      },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    if (existingCourse.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    const course = await prisma.course.update({
      where: {
        id,
      },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error('Failed to update course:', error);
    return NextResponse.json(
      { error: 'Failed to update course' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/courses/[id] - Delete a specific course
export async function DELETE(
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

    // Check if the course exists and belongs to the user
    const existingCourse = await prisma.course.findUnique({
      where: {
        id,
      },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    if (existingCourse.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Not authorized' },
        { status: 403 }
      );
    }

    // Delete the course (documents and chats will be cascade deleted)
    await prisma.course.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete course:', error);
    return NextResponse.json(
      { error: 'Failed to delete course' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 