import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { POST as uploadPDF } from '../app/api/courses/[id]/upload/route';
import { getServerSession } from 'next-auth';
import { createTestUser, createTestCourse, cleanupTestData, disconnectPrisma } from '../lib/test-utils';

// Mock getServerSession
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

describe('PDF Upload Tests', () => {
  let testUser: any;
  let testCourse: any;

  beforeAll(async () => {
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

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  test('PDF upload should create a document record', async () => {
    // Create a mock PDF file using FormData
    const formData = new FormData();
    
    // Create a simple PDF-like file
    const pdfBlob = new Blob(['%PDF-1.5 mock PDF content'], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], 'test.pdf', { type: 'application/pdf' });
    
    formData.append('file', pdfFile);
    formData.append('title', 'Test PDF Upload');
    
    // Create request with FormData
    const request = new Request('http://localhost:3000/api/courses/' + testCourse.id + '/upload', {
      method: 'POST',
      body: formData
    });
    
    // Mock params
    const params = { id: testCourse.id };
    
    // Call the upload endpoint
    const response = await uploadPDF(request, { params });
    const result = await response.json();
    
    // Check response
    expect(response.status).toBe(200);
    expect(result.title).toBe('Test PDF Upload');
    expect(result.message).toBe('PDF uploaded successfully');
  });

  test('PDF upload should reject when no file is provided', async () => {
    // Create empty FormData
    const formData = new FormData();
    formData.append('title', 'Test PDF Upload Without File');
    
    // Create request with FormData
    const request = new Request('http://localhost:3000/api/courses/' + testCourse.id + '/upload', {
      method: 'POST',
      body: formData
    });
    
    // Mock params
    const params = { id: testCourse.id };
    
    // Call the upload endpoint
    const response = await uploadPDF(request, { params });
    const result = await response.json();
    
    // Check response
    expect(response.status).toBe(400);
    expect(result.error).toBe('No file provided');
  });

  test('PDF upload should reject when no title is provided', async () => {
    // Create a FormData with file but no title
    const formData = new FormData();
    
    // Create a simple PDF-like file
    const pdfBlob = new Blob(['%PDF-1.5 mock PDF content'], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], 'test.pdf', { type: 'application/pdf' });
    
    formData.append('file', pdfFile);
    
    // Create request with FormData
    const request = new Request('http://localhost:3000/api/courses/' + testCourse.id + '/upload', {
      method: 'POST',
      body: formData
    });
    
    // Mock params
    const params = { id: testCourse.id };
    
    // Call the upload endpoint
    const response = await uploadPDF(request, { params });
    const result = await response.json();
    
    // Check response
    expect(response.status).toBe(400);
    expect(result.error).toBe('Document title is required');
  });
}); 