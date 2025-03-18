const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Path for the test PDF
const testPdfPath = path.join(uploadsDir, "test.pdf");

// Create a document
const doc = new PDFDocument();

// Pipe its output to the file
doc.pipe(fs.createWriteStream(testPdfPath));

// Add content to the PDF
doc
  .fontSize(25)
  .text("Test PDF Document", 100, 100)
  .fontSize(12)
  .moveDown()
  .text(
    "This is a test PDF document created for testing PDF.js worker configuration.",
  )
  .moveDown()
  .text(
    "If you can read this text, then PDF text extraction is working correctly!",
  )
  .moveDown(2)
  .text(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus at pharetra nunc. Cras ut risus vel eros vehicula fermentum. Quisque lacinia arcu eu nibh pellentesque tincidunt. Cras vitae ante ac magna facilisis dictum eu vitae mi. Nullam condimentum vel lorem vitae tempus.",
  )
  .moveDown()
  .text(
    "Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec ultrices hendrerit quam, vitae consectetur est vulputate eget. Integer tincidunt ex non tortor feugiat, in fringilla libero facilisis.",
  )
  .moveDown()
  .text(
    "Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Vivamus ac neque a diam facilisis pulvinar a at metus. Integer ornare, mauris eget vulputate bibendum, nibh sapien facilisis tellus, in cursus erat mauris vel nibh.",
  );

// Add another page
doc
  .addPage()
  .fontSize(20)
  .text("Second Page", 100, 100)
  .fontSize(12)
  .moveDown()
  .text("This is the second page of the test PDF document.")
  .moveDown()
  .text("Testing multiple pages for PDF.js extraction...");

// Finalize the PDF and end the stream
doc.end();

console.log(`Test PDF created at: ${testPdfPath}`);
console.log(
  "You can now run the test-pdf-processing.js script to test PDF.js worker configuration.",
);
