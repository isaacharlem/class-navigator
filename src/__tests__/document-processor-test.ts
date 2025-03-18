import { describe, test, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { processDocument } from '../lib/documentProcessor';
import { createTestUser, createTestCourse, cleanupTestData, disconnectPrisma } from '../lib/test-utils';
import { PrismaClient } from '@prisma/client';

// Mock pdf-parse
jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation(() => {
    return Promise.resolve({
      text: 'Mocked PDF content',
      numpages: 1,
      info: {
        PDFFormatVersion: '1.5',
        IsAcroFormPresent: false,
        IsXFAPresent: false,
      },
      metadata: null,
      version: '1.0.0'
    });
  });
});

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockImplementation((url: string, options: any) => {
    if (url.endsWith('.pdf')) {
      return Promise.resolve({ data: Buffer.from('Mock PDF data') });
    }
    return Promise.resolve({ data: '<html><body>Mock webpage content</body></html>' });
  })
}));

const prisma = new PrismaClient();

describe('Document Processor Tests', () => {
  let testUser: any;
  let testCourse: any;
  let testDocument: any;

  beforeAll(async () => {
    // Create test data
    testUser = await createTestUser();
    testCourse = await createTestCourse(testUser.id);
    
    // Create a test document
    testDocument = await prisma.document.create({
      data: {
        title: 'Test Document',
        type: 'text',
        content: 'This is test content for document processing',
        processed: false,
        courseId: testCourse.id,
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await disconnectPrisma();
  });

  test('processDocument should process text documents', async () => {
    // Process the document
    await processDocument(testDocument);
    
    // Retrieve the processed document
    const processedDoc = await prisma.document.findUnique({
      where: { id: testDocument.id }
    });
    
    // Check if the document was processed
    expect(processedDoc?.processed).toBe(true);
    
    // Check for vector store entries
    const vectorEntries = await prisma.vectorStore.findMany({
      where: { documentId: testDocument.id }
    });
    
    expect(vectorEntries.length).toBeGreaterThan(0);
  });

  test('processDocument should handle PDF documents', async () => {
    // Create a PDF document
    const pdfDocument = await prisma.document.create({
      data: {
        title: 'Test PDF Document',
        type: 'pdf',
        content: null,
        url: 'https://example.com/test.pdf',
        fileName: 'test.pdf',
        fileSize: 1024,
        processed: false,
        courseId: testCourse.id,
      }
    });
    
    // Process the document
    await processDocument(pdfDocument);
    
    // Retrieve the processed document
    const processedDoc = await prisma.document.findUnique({
      where: { id: pdfDocument.id }
    });
    
    // Check if the document was processed
    expect(processedDoc?.processed).toBe(true);
  });
}); 