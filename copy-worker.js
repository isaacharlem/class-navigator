const fs = require('fs');
const path = require('path');

/**
 * This script copies the PDF.js worker file to the public directory
 * so it can be accessed by the browser.
 */

// Create the public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.log('Creating public directory...');
  fs.mkdirSync(publicDir, { recursive: true });
}

// Find the PDF.js worker file
try {
  // Get the path to the worker file
  const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.js');
  console.log('PDF.js worker file found at:', workerPath);
  
  // Copy to public directory
  const destination = path.join(publicDir, 'pdf.worker.min.js');
  fs.copyFileSync(workerPath, destination);
  console.log('PDF.js worker file copied to:', destination);
  
  // Also copy the non-minified version as fallback
  try {
    const fullWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.js');
    const fullDestination = path.join(publicDir, 'pdf.worker.js');
    fs.copyFileSync(fullWorkerPath, fullDestination);
    console.log('Non-minified PDF.js worker file copied to:', fullDestination);
  } catch (error) {
    console.warn('Could not copy non-minified worker file:', error.message);
  }
  
  console.log('PDF.js worker files copied successfully!');
} catch (error) {
  console.error('Error copying PDF.js worker file:', error);
  
  // Try alternative path
  try {
    // Try alternative path for older versions of PDF.js
    const altWorkerPath = path.join(
      path.dirname(require.resolve('pdfjs-dist/package.json')),
      'build',
      'pdf.worker.min.js'
    );
    
    if (fs.existsSync(altWorkerPath)) {
      console.log('PDF.js worker file found at alternative path:', altWorkerPath);
      
      // Copy to public directory
      const destination = path.join(publicDir, 'pdf.worker.min.js');
      fs.copyFileSync(altWorkerPath, destination);
      console.log('PDF.js worker file copied to:', destination);
    } else {
      console.error('PDF.js worker file not found at alternative path either');
    }
  } catch (altError) {
    console.error('Error with alternative worker path:', altError);
  }
} 