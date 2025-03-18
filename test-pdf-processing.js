require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { processPdfWithAssistant } = require("./src/lib/assistantService");

/**
 * Test script for PDF processing using OpenAI Assistant API
 */
console.log("Starting PDF processing test with OpenAI Assistant API...");

// Simple function to test PDF processing
async function testPdfProcessing() {
  console.log("Starting test PDF processing...");

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

  try {
    // Read the PDF file
    console.log("Reading PDF file...");
    const pdfBuffer = fs.readFileSync(testPdfPath);
    console.log("PDF file read successfully, size:", pdfBuffer.length, "bytes");

    // Create a mock document for processing
    const mockDocument = {
      id: "test-" + Date.now(),
      type: "pdf",
      title: "Test PDF",
      processed: false,
      courseId: "test-course",
      fileName: path.basename(testPdfPath),
      _buffer: pdfBuffer,
    };

    // Process the PDF document using the Assistant API
    console.log("Processing PDF with OpenAI Assistant API...");
    const startTime = Date.now();
    const extractedText = await processPdfWithAssistant(mockDocument);
    const endTime = Date.now();

    console.log(
      `PDF processing completed in ${(endTime - startTime) / 1000} seconds`,
    );
    console.log(`Extracted ${extractedText.length} characters`);

    // Show a preview of the extracted text
    console.log("\nText preview (first 500 characters):");
    console.log("=".repeat(80));
    console.log(extractedText.substring(0, 500) + "...");
    console.log("=".repeat(80));

    // Write the full result to a file for inspection
    const resultPath = path.join(__dirname, "pdf-extraction-result.txt");
    fs.writeFileSync(resultPath, extractedText);
    console.log(`\nFull extracted text saved to: ${resultPath}`);

    console.log("\nPDF processing test completed successfully!");
  } catch (error) {
    console.error("Error processing PDF:", error);
  }
}

// Run the test
testPdfProcessing().catch((error) => {
  console.error("Unhandled error in test execution:", error);
});
