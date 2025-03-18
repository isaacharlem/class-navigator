import { PrismaClient } from '@prisma/client';
import { Session } from 'next-auth';

const prisma = new PrismaClient();

/**
 * Creates a test user for testing API endpoints
 */
export async function createTestUser() {
  const existingUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashed_password', // In a real app this would be hashed
    }
  });
}

/**
 * Creates a test course for a user
 */
export async function createTestCourse(userId: string) {
  return prisma.course.create({
    data: {
      name: 'Test Course',
      description: 'A course created for testing purposes',
      userId,
    }
  });
}

/**
 * Creates a test document for a course
 */
export async function createTestDocument(courseId: string, type: 'text' | 'url' | 'pdf' = 'text') {
  return prisma.document.create({
    data: {
      title: `Test ${type.toUpperCase()} Document`,
      type,
      content: type === 'text' ? 'This is test content' : null,
      url: type === 'url' ? 'https://example.com' : null,
      fileName: type === 'pdf' ? 'test.pdf' : null,
      fileSize: type === 'pdf' ? 1024 : null,
      processed: true,
      courseId,
    }
  });
}

/**
 * Creates a test chat for a course
 */
export async function createTestChat(userId: string, courseId: string) {
  return prisma.chat.create({
    data: {
      title: 'Test Chat',
      type: 'general',
      userId,
      courseId,
    }
  });
}

/**
 * Creates a mock session for testing authentication
 */
export function createMockSession(userId: string): Session {
  return {
    user: {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Cleans up test data
 */
export async function cleanupTestData() {
  await prisma.message.deleteMany({
    where: {
      chat: {
        title: { startsWith: 'Test' }
      }
    }
  });
  
  await prisma.chat.deleteMany({
    where: {
      title: { startsWith: 'Test' }
    }
  });
  
  await prisma.document.deleteMany({
    where: {
      title: { startsWith: 'Test' }
    }
  });
  
  await prisma.course.deleteMany({
    where: {
      name: { startsWith: 'Test' }
    }
  });
  
  // Don't delete the test user as it might be reused
}

/**
 * Disconnect the Prisma client after tests
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
} 