const path = require("path");
const fs = require("fs");

// Try to find PDF.js worker in the standard v3.x path
try {
  const pdfjsDistPath = path.dirname(
    require.resolve("pdfjs-dist/package.json"),
  );
  const pdfWorkerPath = path.join(pdfjsDistPath, "build", "pdf.worker.js");

  if (fs.existsSync(pdfWorkerPath)) {
    console.log("✅ PDF.js worker found at:", pdfWorkerPath);
    console.log(
      "File size:",
      (fs.statSync(pdfWorkerPath).size / 1024 / 1024).toFixed(2),
      "MB",
    );
  } else {
    console.error("❌ PDF.js worker not found at:", pdfWorkerPath);

    // Try alternative paths
    try {
      const alternativeWorkerPath = require.resolve(
        "pdfjs-dist/build/pdf.worker.js",
      );
      if (fs.existsSync(alternativeWorkerPath)) {
        console.log(
          "✅ PDF.js worker found at alternative path:",
          alternativeWorkerPath,
        );
        console.log(
          "File size:",
          (fs.statSync(alternativeWorkerPath).size / 1024 / 1024).toFixed(2),
          "MB",
        );
      } else {
        console.error(
          "❌ PDF.js worker not found at alternative path:",
          alternativeWorkerPath,
        );
      }
    } catch (error) {
      console.error(
        "❌ Error resolving alternative worker path:",
        error.message,
      );
    }
  }
} catch (error) {
  console.error("❌ Error resolving PDF.js path:", error.message);
}

// Also check for proper import
try {
  const pdfjsLib = require("pdfjs-dist");
  console.log(
    "✅ PDF.js library imported successfully, version:",
    pdfjsLib.version,
  );
} catch (error) {
  console.error("❌ Error importing PDF.js library:", error.message);
}
