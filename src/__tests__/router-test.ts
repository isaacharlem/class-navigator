import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as getCourse } from '../app/api/courses/[id]/route';
import { getServerSession } from 'next-auth';
import { createTestUser, createTestCourse, createMockSession } from '../lib/test-utils';

// Mock getServerSession
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Specifically test the params.id issue
describe('Route Params Tests', () => {
  let testUser: any;
  let testCourse: any;

  beforeEach(async () => {
    // Create test data
    testUser = await createTestUser();
    testCourse = await createTestCourse(testUser.id);
    
    // Mock authentication
    (getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: testUser.id,
        name: 'Test User',
        email: 'test@example.com',
      }
    });
  });

  test('Route should handle params.id correctly', async () => {
    // Create the request
    const req = new NextRequest(`http://localhost:3000/api/courses/${testCourse.id}`);
    
    // Call the endpoint with mocked params
    const params = { id: testCourse.id };
    const response = await getCourse(req, { params });
    const data = await response.json();
    
    // Verify the course is returned and uses the correct id
    expect(response.status).toBe(200);
    expect(data.id).toBe(testCourse.id);
    expect(data.name).toBe('Test Course');
  });

  test('Route should return 404 for non-existent course', async () => {
    // Create the request with a non-existent id
    const req = new NextRequest('http://localhost:3000/api/courses/non-existent-id');
    
    // Call the endpoint with mocked params
    const params = { id: 'non-existent-id' };
    const response = await getCourse(req, { params });
    const data = await response.json();
    
    // Verify the response has the expected error
    expect(response.status).toBe(404);
    expect(data.error).toBeTruthy();
  });
}); 