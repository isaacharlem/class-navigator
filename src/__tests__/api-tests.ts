import { NextRequest, NextResponse } from 'next/server';
import { expect, test, describe, beforeEach, afterAll } from 'vitest';
import { GET as getCourses } from '../app/api/courses/route';
import { GET as getRecentChats } from '../app/api/chats/recent/route';
import * as nextAuth from 'next-auth';
import { 
  createTestUser, 
  createTestCourse, 
  createTestDocument,
  createTestChat,
  createMockSession,
  cleanupTestData,
  disconnectPrisma 
} from '../lib/test-utils';

// Mock getServerSession
vi.mock('next-auth', async () => {
  const actual = await vi.importActual('next-auth');
  return {
    ...actual,
    getServerSession: vi.fn(),
  };
});

describe('API Tests', () => {
  let testUser: any;
  let testCourse: any;
  let testSession: any;

  beforeEach(async () => {
    // Create test data
    testUser = await createTestUser();
    testCourse = await createTestCourse(testUser.id);
    testSession = createMockSession(testUser.id);
    
    // Mock authentication
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(testSession);
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  test('GET /api/courses returns courses for authenticated user', async () => {
    const req = new NextRequest('http://localhost:3000/api/courses');
    const response = await getCourses(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((course: any) => course.id === testCourse.id)).toBe(true);
  });

  test('GET /api/chats/recent returns chats for authenticated user', async () => {
    // Create a test chat first
    const chat = await createTestChat(testUser.id, testCourse.id);
    
    const req = new NextRequest('http://localhost:3000/api/chats/recent');
    const response = await getRecentChats(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((c: any) => c.id === chat.id)).toBe(true);
  });

  test('Unauthenticated requests are rejected', async () => {
    // Mock unauthenticated session
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(null);
    
    const req = new NextRequest('http://localhost:3000/api/courses');
    const response = await getCourses(req);
    
    expect(response.status).toBe(401);
  });
}); 