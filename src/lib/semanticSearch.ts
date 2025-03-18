import { PrismaClient } from '@prisma/client';
import { OpenAIEmbeddings } from '@langchain/openai';

const prisma = new PrismaClient();

interface SearchResult {
  documentId: string;
  chunk: string;
  similarity: number;
}

interface DocumentResult {
  id: string;
  title: string;
  courseId: string;
  processed: boolean;
}

/**
 * Search for relevant document chunks using semantic similarity
 */
export async function semanticSearch(
  query: string,
  courseId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    console.log(`Performing semantic search for query "${query}" in course ${courseId}`);
    
    // First, check if there are any documents for this course
    const courseDocuments = await prisma.document.findMany({
      where: {
        courseId,
        processed: true,
      },
    });
    
    console.log(`Found ${courseDocuments.length} processed documents in the course`);
    
    if (courseDocuments.length === 0) {
      console.log('No processed documents found. Make sure documents are uploaded and processed.');
      return [];
    }
    
    // Get document IDs
    const documentIds = courseDocuments.map((doc: {id: string}) => doc.id);
    console.log(`Document IDs: ${documentIds.join(', ')}`);
    
    // Generate embedding for the query
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    const queryEmbedding = await embeddings.embedQuery(query);
    console.log(`Generated query embedding with ${queryEmbedding.length} dimensions`);
    
    // Get all document vectors for the course
    const documentVectors = await prisma.vectorStore.findMany({
      where: {
        documentId: {
          in: documentIds,
        },
      },
      include: {
        document: true,
      },
    });
    
    console.log(`Found ${documentVectors.length} vector chunks from documents`);
    
    if (documentVectors.length === 0) {
      console.log('No vector embeddings found. Document processing might have failed.');
      return [];
    }
    
    // Calculate cosine similarity between query and each document vector
    const similarities: SearchResult[] = [];
    
    for (const vector of documentVectors) {
      try {
        // Parse the stored embedding string back to an array
        const embeddingVector = JSON.parse(vector.embedding);
        
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(queryEmbedding, embeddingVector);
        
        similarities.push({
          documentId: vector.documentId,
          chunk: vector.chunk,
          similarity,
        });
        
        console.log(`Chunk from document ${vector.documentId} has similarity ${similarity.toFixed(4)}`);
      } catch (error) {
        console.error(`Error processing vector for document ${vector.documentId}:`, error);
      }
    }
    
    // Sort by similarity (descending) and take the top 'limit' results
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    console.log(`Returning top ${results.length} most relevant chunks`);
    return results;
      
  } catch (error) {
    console.error('Error performing semantic search:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  // Check if vectors have the same length
  if (vecA.length !== vecB.length) {
    console.error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
    return 0;
  }
  
  try {
    // Calculate dot product
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    
    // Calculate magnitudes
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    // Calculate cosine similarity
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    return dotProduct / (magnitudeA * magnitudeB);
  } catch (error) {
    console.error('Error calculating cosine similarity:', error);
    return 0;
  }
} 