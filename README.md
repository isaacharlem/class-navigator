# Class Navigator

A Next.js application that helps students and learners organize course materials and interact with their content through an AI assistant. The app enables users to upload documents (text, URL, PDF) and then chat with an AI assistant about the content.

## Features

- 🔐 User authentication
- 📚 Course management
- 📄 Document uploading (text, URLs, PDFs)
- 💬 AI chat assistant with citations
- 📝 Course-specific chats
- 📋 Document organization

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Setup

Create a `.env.local` file with the following variables:

```
# Database
DATABASE_URL=file:./dev.db

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Pinecone (for vector storage)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX=your-pinecone-index
```

## PDF Processing

The application supports PDF document processing using OpenAI's Assistant API for text extraction while maintaining document structure and formatting.

## Technologies Used

- Next.js 15
- React 19
- Prisma ORM
- OpenAI API
- Pinecone Vector Database
- NextAuth.js
- Tailwind CSS

## Available Scripts

The project includes several scripts for development, testing, and specialized tasks:

### Development
- `npm run dev` - Start the development server with Turbopack
- `npm run dev:pdf` - Start development server with PDF.js worker setup
- `npm run build` - Build the application for production
- `npm run start` - Start the production server

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:api` - Run API-specific tests

### PDF Processing
- `npm run pdf:test` - Test PDF processing with document processor
- `npm run pdf:assistant-test` - Test PDF processing directly with OpenAI Assistant

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
