import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatOpenAI } from '@langchain/openai';
import { authOptions } from '../../auth/[...nextauth]/route';
import { AIChatOptions } from '@/types/types';
import { semanticSearch } from '@/lib/semanticSearch';
import axios from 'axios';

const prisma = new PrismaClient();

// POST /api/chat/[id] - Send a message to the chat
export async function POST(
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

    const { message, options } = await req.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate chat exists and belongs to the user
    const chat = await prisma.chat.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        course: true,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        content: message,
        role: 'user',
        chatId: id,
      },
    });

    // Get recent chat history for context
    const chatHistory = await prisma.message.findMany({
      where: {
        chatId: id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Limit to 10 most recent messages
    });

    // Initialize OpenAI chat model
    const chatModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    let assistantContent = '';
    let citations: Array<{documentId: string, sourceText: string}> = [];

    try {
      // Prepare the context and system message
      let systemMessage = `You are an AI course assistant for "${chat.course.name}". 
Your job is to help the student understand course materials and answer their questions.
Be helpful, clear, and educational in your responses.`;

      // Convert chat history to the format expected by the OpenAI API
      const messages = [
        { role: "system", content: systemMessage },
        ...chatHistory.map((msg: {role: string, content: string}) => ({ 
          role: msg.role as "user" | "assistant", 
          content: msg.content 
        }))
      ];

      // If web search is enabled, add that to system message
      if (options.enableWebSearch) {
        messages[0].content += " You can search the web for additional information to supplement your answers.";
        
        // Perform web search if enabled
        try {
          const webResults = await performWebSearch(message);
          if (webResults) {
            systemMessage += `\n\nWeb search results related to the query:\n${webResults}`;
            messages[0].content = systemMessage;
          }
        } catch (error) {
          console.error('Error performing web search:', error);
        }
      }

      // If citations are enabled, add that to system message
      if (options.enableCitations) {
        messages[0].content += " Please cite sources when possible using [Document Title] format at the end of relevant sentences.";
      }

      // Perform semantic search to find relevant document chunks
      const searchResults = await semanticSearch(message, chat.course.id, 5);
      console.log(`Found ${searchResults.length} relevant documents for query: "${message}"`);

      // Add relevant document chunks to the context
      if (searchResults.length > 0) {
        const documentContexts = await Promise.all(
          searchResults.map(async (result) => {
            const document = await prisma.document.findUnique({
              where: { id: result.documentId },
              select: { title: true, id: true },
            });
            
            console.log(`Adding document "${document?.title}" with similarity ${result.similarity}`);
            
            return {
              title: document?.title || 'Unknown Document',
              id: document?.id || '',
              content: result.chunk,
              similarity: result.similarity,
            };
          })
        );

        // Add document contexts to system message
        systemMessage += '\n\nThe following are relevant sections from course materials:\n\n';
        
        documentContexts.forEach((doc, index) => {
          systemMessage += `Document ${index + 1}: "${doc.title}"\n${doc.content}\n\n`;
          
          // Store document info for citations
          if (options.enableCitations) {
            citations.push({
              documentId: doc.id,
              sourceText: doc.content.substring(0, 150) + '...',  // Shorter citation text
            });
          }
        });
        
        // Update the system message with document contexts
        messages[0].content = systemMessage;
      } else {
        console.log('No relevant documents found for this query. Using general knowledge.');
        
        // Add a note about no relevant documents found
        systemMessage += '\n\nNo specific course materials were found for this query. I will answer based on general knowledge.';
        messages[0].content = systemMessage;
      }

      // Call the OpenAI API with enhanced context
      const response = await chatModel.invoke(messages);
      assistantContent = response.content.toString();

      // Process citations if enabled and found in the response
      if (options.enableCitations && citations.length > 0) {
        // Remove any citations we're finding in the actual database
        // This is because we'll create proper citations in the database
        assistantContent = assistantContent.replace(/\[.*?\]/g, '');
      }
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      assistantContent = "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
    
    // Save assistant message to database
    const assistantMessage = await prisma.message.create({
      data: {
        content: assistantContent,
        role: 'assistant',
        chatId: id,
        citations: {
          create: citations.map(citation => ({
            documentId: citation.documentId,
            sourceText: citation.sourceText,
          })),
        },
      },
      include: {
        citations: true,
      },
    });

    return NextResponse.json({
      id: assistantMessage.id,
      content: assistantMessage.content,
      citations: assistantMessage.citations,
    });
  } catch (error) {
    console.error('Failed to process chat message:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Perform a web search for additional information
 * Uses Google's Programmable Search API
 */
async function performWebSearch(query: string): Promise<string | null> {
  try {
    // Google Programmable Search Engine API parameters
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    // If API key or search engine ID is not available, return notice
    if (!apiKey || !searchEngineId) {
      console.error('Google Search API key or Search Engine ID is missing');
      return `To enable web search, please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in your environment variables.`;
    }
    
    // Make API request to Google Custom Search
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: 5 // Number of search results (max 10)
      }
    });
    
    // Check if we got valid search results
    if (response.data && response.data.items && response.data.items.length > 0) {
      // Format the search results
      const results = response.data.items
        .slice(0, 3) // Limit to top 3 results to keep context manageable
        .map((item: any, index: number) => {
          // Format as a numbered result with title, snippet and link
          return `${index + 1}. ${item.title}\n   ${item.snippet}\n   [${item.link}]`;
        })
        .join('\n\n');
      
      return `Search results for "${query}":\n\n${results}`;
    }
    
    // No search results found
    return `No search results found for "${query}".`;
  } catch (error) {
    console.error('Error during web search:', error);
    
    // Check if error is related to API key or quota
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      if (status === 403) {
        return `Search error: API quota exceeded or invalid API key. Please check your Google API credentials.`;
      }
      if (status === 400) {
        return `Search error: Invalid search request. Please try a different query.`;
      }
    }
    
    // Generic error message
    return `Error performing web search: Unable to retrieve results at this time.`;
  }
}

// GET /api/chat/[id] - Get a specific chat
export async function GET(
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

    // Fetch chat with course details
    const chat = await prisma.chat.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error('Failed to fetch chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 