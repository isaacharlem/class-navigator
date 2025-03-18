// Setup globals for tests
require('@testing-library/jest-dom');

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    reload: jest.fn(),
    refresh: jest.fn(),
    forward: jest.fn(),
  }),
  useParams: () => ({
    id: 'test-id'
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Polyfill for Web APIs
if (typeof FormData === 'undefined') {
  global.FormData = require('form-data');
}

if (typeof Blob === 'undefined') {
  global.Blob = require('blob-polyfill').Blob;
}

if (typeof File === 'undefined') {
  global.File = require('file-api').File;
}

// Set up environment variables for testing
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'test-api-key'; 