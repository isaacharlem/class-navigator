// Test script for Assistant-based PDF processing
require("dotenv").config();
require("dotenv").config({ path: ".env.local" });

const fs = require("fs");
const path = require("path");

// We need to transpile TypeScript files for direct Node.js execution
// Use a different approach - directly testing the PDF conversion instead
// of trying to import the TypeScript modules

console.log("Testing PDF processing with OpenAI Assistant API...");

// Simple function to test PDF processing using direct API calls
async function testPdfProcessing() {
  console.log("Starting PDF processing test...");

  // Check if a PDF file exists in the uploads directory or root
  let testPdfPath = path.join(__dirname, "uploads", "test.pdf");

  if (!fs.existsSync(testPdfPath)) {
    // Check in root directory
    testPdfPath = path.join(__dirname, "test.pdf");
    if (!fs.existsSync(testPdfPath)) {
      console.log("No test PDF file found. Please place a PDF file at either:");
      console.log(`- ${path.join(__dirname, "uploads", "test.pdf")}`);
      console.log(`- ${path.join(__dirname, "test.pdf")}`);
      console.log("Then run this script again.");
      process.exit(0);
    }
  }

  console.log("Test PDF file found at:", testPdfPath);
  console.log("Reading PDF file...");

  const pdfBuffer = fs.readFileSync(testPdfPath);
  console.log("PDF file read successfully, size:", pdfBuffer.length, "bytes");

  // Get API key from environment or use the one from .env.local
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is missing.");
    console.error("Please set it in your .env.local file or environment.");
    process.exit(1);
  }

  console.log("OpenAI API key loaded successfully.");

  // Initialize OpenAI client
  const { OpenAI } = require("openai");
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  console.log("Creating OpenAI assistant for PDF processing...");

  try {
    // Create assistant
    const assistant = await openai.beta.assistants.create({
      name: "PDF Test Processor",
      description: "Test assistant for PDF processing",
      model: "gpt-4o",
      instructions:
        "Extract all text from PDF documents accurately, maintaining structure and formatting.",
      tools: [{ type: "file_search" }],
    });

    console.log(`Created test assistant with ID: ${assistant.id}`);

    // Create a temporary file
    const tempFilePath = path.join(__dirname, "temp-test.pdf");
    fs.writeFileSync(tempFilePath, pdfBuffer);

    try {
      // Upload file to OpenAI
      console.log(`Uploading PDF to OpenAI...`);
      const file = await openai.files.create({
        file: fs.createReadStream(tempFilePath),
        purpose: "assistants",
      });

      console.log(`File uploaded with ID: ${file.id}`);

      // Create a thread
      const thread = await openai.beta.threads.create();
      console.log(`Created thread: ${thread.id}`);

      // Add message to thread with file attachment
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content:
          "Please extract all text from this PDF document. Maintain all formatting, paragraphs, and structure.",
        attachments: [
          {
            file_id: file.id,
            tools: [{ type: "file_search" }],
          },
        ],
      });

      // Run the assistant
      console.log("Running assistant to process the PDF...");
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      // Poll for completion
      const startTime = Date.now();
      let runStatus = await openai.beta.threads.runs.retrieve(
        thread.id,
        run.id,
      );

      while (
        runStatus.status !== "completed" &&
        runStatus.status !== "failed" &&
        Date.now() - startTime < 15 * 60 * 1000
      ) {
        console.log(`Processing status: ${runStatus.status}`);
        // Wait 3 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 3000));
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      }

      if (runStatus.status !== "completed") {
        throw new Error(
          `PDF processing failed or timed out: ${runStatus.status}`,
        );
      }

      // Get the messages
      const messages = await openai.beta.threads.messages.list(thread.id);

      // Extract assistant's response
      const assistantMessages = messages.data.filter(
        (msg) => msg.role === "assistant",
      );

      if (assistantMessages.length === 0) {
        throw new Error("No response from assistant");
      }

      // Extract text content from the response
      let extractedText = "";
      for (const message of assistantMessages) {
        for (const content of message.content) {
          if (content.type === "text") {
            extractedText += content.text.value + "\n\n";
          }
        }
      }

      console.log(
        `Successfully extracted ${extractedText.length} characters from PDF`,
      );

      // Show a preview
      console.log("\nText preview (first 500 characters):");
      console.log("=".repeat(80));
      console.log(extractedText.substring(0, 500) + "...");
      console.log("=".repeat(80));

      // Write the full result to a file for inspection
      const resultPath = path.join(__dirname, "pdf-extraction-result.txt");
      fs.writeFileSync(resultPath, extractedText);
      console.log(`\nFull extracted text saved to: ${resultPath}`);

      // Clean up
      console.log("Cleaning up test resources...");
      // Delete the local temp file
      fs.unlinkSync(tempFilePath);

      // Delete the assistant (optional)
      // await openai.beta.assistants.del(assistant.id);

      console.log("Test completed successfully!");
    } finally {
      // Ensure temp file is deleted even if processing fails
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  } catch (error) {
    console.error("Error running PDF test:", error);
  }
}

// Run the test
testPdfProcessing().catch(console.error);
