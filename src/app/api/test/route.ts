import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { 
  createTestUser, 
  createTestCourse, 
  createTestDocument, 
  createTestChat,
  cleanupTestData
} from '@/lib/test-utils';

const prisma = new PrismaClient();

// This is a special endpoint that runs basic functionality tests and returns results
// Only accessible in development environment for safety
export async function GET() {
  // Safety check - only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Test endpoint only available in development mode' },
      { status: 403 }
    );
  }

  const testResults = {
    success: true,
    tests: [] as any[],
    errors: [] as any[],
  };

  try {
    // Test 1: Create test user
    let testUser;
    try {
      testUser = await createTestUser();
      testResults.tests.push({
        name: 'Create test user',
        status: 'passed',
        id: testUser.id,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Create test user',
        error: error.message,
      });
    }

    if (!testUser) {
      return NextResponse.json({
        ...testResults,
        message: 'Failed to create test user, stopping tests',
      });
    }

    // Test 2: Create test course
    let testCourse;
    try {
      testCourse = await createTestCourse(testUser.id);
      testResults.tests.push({
        name: 'Create test course',
        status: 'passed',
        id: testCourse.id,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Create test course',
        error: error.message,
      });
    }

    if (!testCourse) {
      return NextResponse.json({
        ...testResults,
        message: 'Failed to create test course, stopping tests',
      });
    }

    // Test 3: Create test documents (all types)
    try {
      const textDoc = await createTestDocument(testCourse.id, 'text');
      const urlDoc = await createTestDocument(testCourse.id, 'url');
      const pdfDoc = await createTestDocument(testCourse.id, 'pdf');
      
      testResults.tests.push({
        name: 'Create test documents',
        status: 'passed',
        ids: [textDoc.id, urlDoc.id, pdfDoc.id],
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Create test documents',
        error: error.message,
      });
    }

    // Test 4: Create test chat
    try {
      const chat = await createTestChat(testUser.id, testCourse.id);
      testResults.tests.push({
        name: 'Create test chat',
        status: 'passed',
        id: chat.id,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Create test chat',
        error: error.message,
      });
    }

    // Test 5: Query courses API endpoint
    try {
      const courses = await prisma.course.findMany({
        where: { userId: testUser.id },
        include: {
          _count: {
            select: {
              chats: true,
              documents: true,
            },
          },
        },
      });
      
      testResults.tests.push({
        name: 'Query courses API',
        status: 'passed',
        count: courses.length,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Query courses API',
        error: error.message,
      });
    }

    // Test 6: Query chats API endpoint
    try {
      const chats = await prisma.chat.findMany({
        where: {
          userId: testUser.id,
        },
        include: {
          course: {
            select: {
              name: true,
            },
          },
        },
      });
      
      testResults.tests.push({
        name: 'Query chats API',
        status: 'passed',
        count: chats.length,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Query chats API',
        error: error.message,
      });
    }

    // Test 7: Query documents API endpoint
    try {
      const documents = await prisma.document.findMany({
        where: {
          course: {
            userId: testUser.id,
          },
        },
      });
      
      testResults.tests.push({
        name: 'Query documents API',
        status: 'passed',
        count: documents.length,
      });
    } catch (error: any) {
      testResults.success = false;
      testResults.errors.push({
        test: 'Query documents API',
        error: error.message,
      });
    }

    // Optional: Clean up test data
    // Uncomment if you want to clean up after tests
    // await cleanupTestData();

    return NextResponse.json({
      ...testResults,
      message: 'All tests completed',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: 'Test execution failed',
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 