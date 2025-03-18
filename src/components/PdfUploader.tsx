'use client';

import { useState } from 'react';

interface PdfUploaderProps {
  courseId: string;
  onUploadComplete?: (documentId: string) => void;
}

export default function PdfUploader({ courseId, onUploadComplete }: PdfUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError('');
    
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    // Validate file type
    if (selectedFile.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    
    // Auto-populate title from filename if not already set
    if (!title) {
      // Remove file extension and use as title
      const fileName = selectedFile.name.replace(/\.pdf$/i, '');
      setTitle(fileName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file || !title.trim()) {
      setError('Please select a PDF file and provide a title');
      return;
    }
    
    setUploading(true);
    setError('');
    setSuccess('');
    
    try {
      // Create FormData object for file upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Ensure title is properly set
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error('Document title is required');
      }
      formData.append('title', trimmedTitle);

      // Log what we're sending (for debugging)
      console.log(`Uploading PDF: ${file.name}, Size: ${file.size}, Title: ${trimmedTitle}`);

      // IMPORTANT: Make sure we're using the correct endpoint for PDF uploads
      const response = await fetch(`/api/courses/${courseId}/upload`, {
        method: 'POST',
        body: formData,
        // Do NOT set content-type here - browser sets it automatically with boundary for FormData
      });

      // Log the response for debugging
      console.log('Upload response status:', response.status);
      
      // Try to parse response as JSON
      let data;
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload PDF');
      }

      setSuccess('PDF uploaded successfully (OCR processing enabled)');
      setFile(null);
      setTitle('');
      
      if (onUploadComplete) {
        onUploadComplete(data.id);
      }
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Upload PDF Document</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 text-sm font-medium mb-1">
            Document Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your PDF"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="pdf-file" className="block text-gray-700 text-sm font-medium mb-1">
            PDF File
          </label>
          <input
            id="pdf-file"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-700"
            required
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">Selected file: {file.name} ({Math.round(file.size / 1024)} KB)</p>
          )}
        </div>
        
        <p className="mt-1 mb-4 text-sm text-gray-600">
          All PDFs are automatically processed with OpenAI Vision OCR for high-quality text extraction
        </p>
        
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </button>
        </div>
      </form>
    </div>
  );
} 