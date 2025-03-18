'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CourseWithChatCount } from '@/types/types';

export default function UploadDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseWithChatCount | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('url');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${params.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch course details');
        }

        const courseData = await response.json();
        setCourse(courseData);
      } catch (err) {
        setError('Error loading course details. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchCourse();
    }
  }, [params.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      // Auto-fill name from filename if empty
      if (!name) {
        setName(selectedFile.name.split('.')[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!name.trim()) {
        throw new Error('Document name is required');
      }

      // For URL type
      if (type === 'url' && !url.trim()) {
        throw new Error('URL is required');
      }

      // For text type
      if (type === 'text' && !content.trim()) {
        throw new Error('Content is required');
      }

      // For file type
      if (type === 'file' && !file) {
        throw new Error('File is required');
      }

      // Process based on type
      let documentData: any = {
        name: name.trim(),
        type,
      };

      if (type === 'url') {
        documentData.url = url.trim();
      } else if (type === 'text') {
        documentData.content = content.trim();
      } else if (type === 'file' && file) {
        // For a real implementation, we would upload the file to a storage service
        // and then process it as needed (extract text, etc.)
        // For demo, we'll read the file as text if it's not too large
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error('File too large. Please upload a file smaller than 10MB.');
        }

        // Update document type based on file extension
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (fileExt === 'pdf') {
          documentData.type = 'pdf';
        } else if (['txt', 'md', 'html', 'css', 'js', 'ts', 'json'].includes(fileExt || '')) {
          documentData.type = 'text';
        } else {
          throw new Error('Unsupported file type. Supported types: PDF, TXT, MD, HTML, CSS, JS, TS, JSON');
        }

        // For text files, read and include content
        if (documentData.type === 'text') {
          const fileContent = await file.text();
          documentData.content = fileContent;
        } else {
          // For PDFs, we would process differently in a real implementation
          // Here we're just simulating it with a placeholder
          documentData.content = `Content of ${file.name} would be processed here`;
        }
      }

      const response = await fetch(`/api/courses/${params.id}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      setSuccessMessage('Document uploaded successfully!');
      
      // Reset form
      setName('');
      setUrl('');
      setContent('');
      setFile(null);

      // Navigate back to course page after a short delay
      setTimeout(() => {
        router.push(`/dashboard/courses/${params.id}`);
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading course details...</p>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <Link
          href={`/dashboard/courses/${params.id}`}
          className="text-sm text-blue-600 hover:text-blue-500"
        >
          Back to Course
        </Link>
      </div>

      {course && (
        <p className="mb-6 text-gray-500">
          Adding document to: <span className="font-semibold text-gray-700">{course.name}</span>
        </p>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-500 text-green-700 px-4 py-3 rounded">
              {successMessage}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Document Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Lecture 1 Notes"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Document Type *
            </label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="url">Website URL</option>
              <option value="text">Text Content</option>
              <option value="file">Upload File</option>
            </select>
          </div>

          {type === 'url' && (
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                URL *
              </label>
              <input
                id="url"
                name="url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/lecture1"
              />
            </div>
          )}

          {type === 'text' && (
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                Content *
              </label>
              <textarea
                id="content"
                name="content"
                rows={10}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter document content here..."
              />
            </div>
          )}

          {type === 'file' && (
            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                File Upload *
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.txt,.md,.html,.css,.js,.ts,.json"
                onChange={handleFileChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Supported file types: PDF, TXT, MD, HTML, CSS, JS, TS, JSON. Maximum file size: 10MB.
              </p>
              {file && (
                <p className="mt-2 text-sm text-gray-700">
                  Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Link
              href={`/dashboard/courses/${params.id}`}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-2"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 