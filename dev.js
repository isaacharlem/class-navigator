#!/usr/bin/env node

/**
 * Development Server Setup Script
 *
 * This script prepares the environment and starts the Next.js development server.
 * It ensures that all required PDF.js worker files are in place before starting.
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// Prepare PDF.js worker files
console.log("Setting up PDF.js worker files...");

// Create public directory if needed
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  console.log("Creating public directory...");
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy worker files to public directory
try {
  // Find worker paths
  let workerFound = false;

  // Try minified version first
  try {
    const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.js");
    const destination = path.join(publicDir, "pdf.worker.min.js");
    fs.copyFileSync(workerPath, destination);
    console.log("Copied minified PDF.js worker to public directory");
    workerFound = true;
  } catch (minError) {
    console.warn("Could not copy minified worker:", minError.message);
  }

  // Try non-minified version
  try {
    const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.js");
    const destination = path.join(publicDir, "pdf.worker.js");
    fs.copyFileSync(workerPath, destination);
    console.log("Copied non-minified PDF.js worker to public directory");
    workerFound = true;
  } catch (error) {
    console.warn("Could not copy non-minified worker:", error.message);
  }

  // Try legacy version
  try {
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
    const destination = path.join(publicDir, "pdf.worker.legacy.js");
    fs.copyFileSync(workerPath, destination);
    console.log("Copied legacy PDF.js worker to public directory");
    workerFound = true;
  } catch (legacyError) {
    console.warn("Could not copy legacy worker:", legacyError.message);
  }

  if (!workerFound) {
    console.error(
      "Failed to copy any PDF.js worker files. Browser PDF processing may not work properly.",
    );
  }
} catch (error) {
  console.error("Error setting up PDF.js worker files:", error);
}

// Start the development server
console.log("Starting Next.js development server...");

const nextDev = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});

nextDev.on("error", (error) => {
  console.error("Failed to start development server:", error);
});

// Handle Ctrl+C properly
process.on("SIGINT", () => {
  console.log("Shutting down development server...");
  nextDev.kill("SIGINT");
  process.exit(0);
});
