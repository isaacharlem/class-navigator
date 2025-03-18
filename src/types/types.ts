import { PrismaClient } from '@prisma/client';

type Course = Awaited<ReturnType<PrismaClient['course']['findUnique']>>;
type Chat = Awaited<ReturnType<PrismaClient['chat']['findUnique']>>;
type Document = Awaited<ReturnType<PrismaClient['document']['findUnique']>>;

export interface CourseWithChatCount extends Course {
  _count: {
    chats: number;
    documents: number;
  };
}

export interface ChatWithCourse extends Chat {
  course: {
    id: string;
    name: string;
  };
}

export interface DocumentWithChunks extends Document {
  vectorStore: {
    id: string;
    chunk: string;
    embedding: string;
  }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  documentId: string;
  sourceText: string;
}

export interface AIChatOptions {
  enableWebSearch: boolean;
  enableCitations: boolean;
} 