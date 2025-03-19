import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { authOptions } from "../../auth/[...nextauth]/route";
import { AIChatOptions } from "@/types/types";
import { semanticSearch } from "@/lib/semanticSearch";
import axios from "axios";
import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/chat/[id] - Send a message to the chat
export async function POST(req: Request, context: { params: { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { message, options } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
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
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        content: message,
        role: "user",
        chatId: id,
      },
    });

    // Get recent chat history for context
    const chatHistory = await prisma.message.findMany({
      where: {
        chatId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 10, // Limit to 10 most recent messages
    });

    // Check if this is the first message in a general chat
    if (chat.type === "general" && chatHistory.length === 1) {
      // Update the chat title based on the first message
      try {
        const chatModel = new ChatOpenAI({
          openAIApiKey: process.env.OPENAI_API_KEY,
          modelName: "gpt-3.5-turbo",
          temperature: 0.7,
        });

        const response = await chatModel.invoke([
          [
            "system",
            `You are a helpful assistant that generates concise, descriptive titles for chat conversations.
            The title should be 3-6 words and reflect the topic or question being discussed.`,
          ],
          [
            "user",
            `Generate a short, descriptive title for a chat about "${chat.course.name}" that starts with this message: "${message}"`,
          ],
        ]);

        let title = response.content.toString().trim();

        // Remove quotes if present
        title = title.replace(/^["'](.*)["']$/, "$1");

        // Truncate if too long
        if (title.length > 50) {
          title = title.substring(0, 47) + "...";
        }

        // Update chat title
        await prisma.chat.update({
          where: { id: chat.id },
          data: { title },
        });
      } catch (error) {
        console.error("Error generating chat title:", error);
        // Continue even if title generation fails
      }
    }

    // Initialize OpenAI chat model
    let assistantContent = "";
    let citations: Array<{ documentId: string; sourceText: string }> = [];

    try {
      // Prepare the context and system message
      let systemMessage = `You are an AI course assistant for "${chat.course.name}".
Your job is to help the student understand course materials and answer their questions.
Be helpful, clear, and educational in your responses. Always respond based on the provided course materials when available.
- When course materials contain information relevant to the query, base your answer primarily on that information.
- Be specific about what the documents say rather than giving generic information.
- When asked about an author's perspective or a paper's content, focus on the exact information from the provided document sections.`;

      // Perform semantic search to find relevant document chunks
      const searchResults = await semanticSearch(message, chat.course.id, 5);
      console.log(
        `Found ${searchResults.length} relevant documents for query: "${message}"`,
      );

      // Add relevant document chunks to the context
      if (searchResults.length > 0) {
        const documentContexts = await Promise.all(
          searchResults.map(async (result) => {
            const document = await prisma.document.findUnique({
              where: { id: result.documentId },
              select: { title: true, id: true },
            });

            console.log(
              `Adding document "${document?.title}" with similarity ${result.similarity}`,
            );

            // Check if the chunk contains actual content or just a placeholder
            const hasPlaceholder =
              result.chunk.includes("Content of") &&
              result.chunk.includes("would be processed here");
            const cleanContent = hasPlaceholder
              ? `[The system found this document relevant, but actual content is not available. This may indicate the document wasn't properly processed.]`
              : result.chunk;

            return {
              title: document?.title || "Unknown Document",
              id: document?.id || "",
              content: cleanContent,
              similarity: result.similarity,
            };
          }),
        );

        // Add document contexts to system message
        systemMessage +=
          "\n\nThe following are relevant sections from course materials:\n\n";

        documentContexts.forEach((doc, index) => {
          systemMessage += `Document ${index + 1}: "${doc.title}"\n${doc.content}\n\n`;

          // Store document info for citations
          if (options.enableCitations) {
            citations.push({
              documentId: doc.id,
              sourceText: `From "${doc.title}":\n${doc.content}`,
            });
          }
        });
      } else {
        console.log(
          "No relevant documents found for this query. Using general knowledge.",
        );
        systemMessage +=
          "\n\nNo specific course materials were found for this query. I will answer based on general knowledge.";
      }

      // Convert chat history to the format expected by the OpenAI API
      const formattedMessages = [
        { role: "system" as const, content: systemMessage },
        ...chatHistory.map((msg) => ({
          role:
            msg.role === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content,
        })),
      ];

      // If web search is enabled, add that to system message
      if (options.enableWebSearch) {
        try {
          const webResults = await performWebSearch(message);
          if (webResults) {
            formattedMessages[0].content += `\n\nWeb search results related to the query:\n${webResults}`;
          }
        } catch (error) {
          console.error("Error performing web search:", error);
        }
      }

      // If citations are enabled, add instruction to add citations
      if (options.enableCitations && citations.length > 0) {
        formattedMessages[0].content +=
          " Explicitly include information from the provided document sections. When referencing document content, be specific about what each document says on the topic.";
      }

      // Add the current user message to the formatted messages
      formattedMessages.push({
        role: "user" as const,
        content: message,
      });

      // Call the OpenAI API directly
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      assistantContent = response.choices[0].message.content || "";

      // Process citations if enabled and found in the response
      if (options.enableCitations && citations.length > 0) {
        // Remove any citations we're finding in the actual database
        // This is because we'll create proper citations in the database
        assistantContent = assistantContent.replace(/\[.*?\]/g, "");

        // Process citations for PDF documents
        const updatedCitations = await Promise.all(
          citations.map(async (citation) => {
            // Get document details to identify if it's a PDF
            const document = await prisma.document.findUnique({
              where: { id: citation.documentId },
              select: { type: true, processed: true, title: true },
            });

            // For PDF documents, improve the citation format
            if (document?.type === "pdf") {
              return {
                documentId: citation.documentId,
                sourceText: citation.sourceText.includes(
                  "system found this document relevant, but actual content is not available",
                )
                  ? `From "${document.title}":\n${citation.sourceText}`
                  : citation.sourceText,
              };
            }

            return citation;
          }),
        );

        // Use updated citations
        citations = updatedCitations;
      }
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      assistantContent =
        "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }

    // Save assistant message to database
    const assistantMessage = await prisma.message.create({
      data: {
        content: assistantContent,
        role: "assistant",
        chatId: id,
        citations: {
          create: citations.map((citation) => ({
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
    console.error("Failed to process chat message:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 },
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
      console.error("Google Search API key or Search Engine ID is missing");
      return `To enable web search, please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in your environment variables.`;
    }

    // Make API request to Google Custom Search
    const response = await axios.get(
      "https://www.googleapis.com/customsearch/v1",
      {
        params: {
          key: apiKey,
          cx: searchEngineId,
          q: query,
          num: 5, // Number of search results (max 10)
        },
      },
    );

    // Check if we got valid search results
    if (
      response.data &&
      response.data.items &&
      response.data.items.length > 0
    ) {
      // Format the search results
      const results = response.data.items
        .slice(0, 3) // Limit to top 3 results to keep context manageable
        .map((item: any, index: number) => {
          // Format as a numbered result with title, snippet and link
          return `${index + 1}. ${item.title}\n   ${item.snippet}\n   [${item.link}]`;
        })
        .join("\n\n");

      return `Search results for "${query}":\n\n${results}`;
    }

    // No search results found
    return `No search results found for "${query}".`;
  } catch (error) {
    console.error("Error during web search:", error);

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
export async function GET(req: Request, context: { params: { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to fetch chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/chat/[id] - Delete a chat
export async function DELETE(
  req: Request,
  context: { params: { id: string } },
) {
  try {
    const params = await context.params;
    const id = params.id;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the chat exists and belongs to the user
    const chat = await prisma.chat.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Delete the chat (messages will be cascade deleted due to the relation)
    await prisma.chat.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
