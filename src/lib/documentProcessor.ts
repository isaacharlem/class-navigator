import { PrismaClient } from "@prisma/client";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import axios from "axios";
import * as cheerio from "cheerio";
import { processPdfWithAssistant } from "./assistantService";
import { DocumentModel } from "@/types/types";

const prisma = new PrismaClient();

/**
 * Process a document and generate embeddings for its content
 */
export async function processDocument(document: DocumentModel): Promise<void> {
  try {
    // Step 1: Extract text based on document type
    const text = await extractText(document);
    if (!text) return;

    // Step 2: Split text into chunks
    const chunks = await splitIntoChunks(text);

    // Step 3: Generate embeddings for each chunk
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Step 4: Store each chunk and its embedding in the database
    for (const chunk of chunks) {
      try {
        const embeddingVector = await embeddings.embedQuery(chunk);

        // Store as a string since SQLite doesn't support array types
        const embeddingString = JSON.stringify(embeddingVector);

        await prisma.vectorStore.create({
          data: {
            documentId: document.id,
            chunk,
            embedding: embeddingString,
          },
        });
      } catch (error) {
        console.error("Error generating embedding for chunk:", error);
        // Continue with other chunks if one fails
      }
    }

    // Update document status to processed
    await prisma.document.update({
      where: { id: document.id },
      data: { processed: true },
    });
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

/**
 * Extract text from a document based on its type
 */
async function extractText(document: DocumentModel): Promise<string | null> {
  switch (document.type) {
    case "text":
      return document.content || "";

    case "url":
      if (!document.url) return null;
      return await extractTextFromUrl(document.url);

    case "pdf":
      console.log("Processing PDF with OpenAI Assistant API");

      try {
        let buffer: Buffer;

        // If we have a direct buffer (from upload), use it
        if (document._buffer) {
          buffer = document._buffer;
        }
        // If we have a URL, download the PDF and process it
        else if (document.url) {
          // Download the PDF from the URL
          const response = await axios.get(document.url, {
            responseType: "arraybuffer",
          });
          buffer = Buffer.from(response.data);
        }
        // If we don't have buffer or URL, but have content, it may be already processed
        else if (
          document.content &&
          !(
            document.content.includes("[") &&
            document.content.includes("]") &&
            (document.content.includes("PROCESSING") ||
              document.content.includes("Error"))
          )
        ) {
          return document.content;
        } else {
          throw new Error(
            `Cannot process PDF document with ID ${document.id}. No content or buffer available.`,
          );
        }

        // Use the Assistant API implementation
        const extractedText = await processPdfWithAssistant({
          ...document,
          _buffer: buffer,
        });

        // Ensure we got actual content, not just a placeholder or error message
        if (
          !extractedText ||
          extractedText.trim() === "" ||
          (extractedText.includes("[") &&
            extractedText.includes("]") &&
            extractedText.includes("Error"))
        ) {
          console.error("Failed to extract proper text content from PDF");
          throw new Error(
            "PDF text extraction failed. No text content was extracted.",
          );
        }

        // For certain error messages related to OpenAI assistant, format appropriately
        let finalText = extractedText;
        if (extractedText.includes("cannot directly extract text") && 
            extractedText.includes("upload the file again")) {
          // This is a specific error message from the OpenAI assistant about PDF extraction
          finalText = `Because of the new implementation with openai assistant, this text cannot be directly extracted from the uploaded PDF document. Please try reprocessing this document for improved extraction.`;
        }

        // Update the document with the extracted text for future use
        await prisma.document.update({
          where: { id: document.id },
          data: { content: finalText },
        });

        console.log(
          `Successfully extracted ${finalText.length} characters of text from PDF`,
        );
        return finalText;
      } catch (error) {
        console.error("Error processing PDF:", error);
        return `[Error processing PDF: ${error instanceof Error ? error.message : "Unknown error"}]`;
      }

    default:
      console.error(`Unsupported document type: ${document.type}`);
      return null;
  }
}

/**
 * Extract text from a URL by scraping the page content
 */
async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Remove script and style elements
    $("script, style").remove();

    // Extract text from the page
    const text = $("body").text();

    // Clean up whitespace
    return text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
  } catch (error) {
    console.error("Error extracting text from URL:", error);
    return "";
  }
}

/**
 * Split text into smaller chunks for embedding
 */
async function splitIntoChunks(text: string): Promise<string[]> {
  // Check if text is a placeholder or error message
  if (
    text.includes("[") &&
    text.includes("]") &&
    (text.includes("PDF Content from") ||
      text.includes("would be processed") ||
      text.includes("Failed to download") ||
      text.includes("Error processing PDF"))
  ) {
    console.warn(
      "Detected placeholder or error text that should not be processed:",
      text,
    );
    throw new Error(
      "Cannot process placeholder or error text. Please ensure actual content is available.",
    );
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  return await splitter.splitText(text);
}
