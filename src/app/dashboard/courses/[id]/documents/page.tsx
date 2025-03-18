'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import PdfUploader from '@/components/PdfUploader';

interface Document {
  id: string;
  title: string;
  type: string;
  url?: string;
  processed: boolean;
  createdAt: string;
}

interface Course {
  id: string;
  name: string;
  description?: string;
}

export default function DocumentsPage() {
  const { id } = useParams();
  const courseId = Array.isArray(id) ? id[0] : id;
  
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [documentType, setDocumentType] = useState<'text' | 'url' | 'pdf'>('text');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated' && courseId) {
      // Fetch course details
      fetch(`/api/courses/${courseId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setCourse(data);
          }
        })
        .catch(err => {
          console.error('Failed to fetch course:', err);
          setError('Failed to fetch course');
        });

      // Fetch course documents
      fetch(`/api/courses/${courseId}/documents`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setDocuments(data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch documents:', err);
          setError('Failed to fetch documents');
          setLoading(false);
        });
    }
  }, [courseId, router, status]);

  const createNewDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    // Skip for PDF uploads as they're handled by the PdfUploader component
    if (documentType === 'pdf') {
      setShowAddDocumentModal(false);
      setCreating(false);
      return;
    }

    try {
      const payload: any = {
        title: documentTitle,
        type: documentType,
      };
      
      if (documentType === 'text') {
        payload.content = documentContent;
      } else if (documentType === 'url' && documentUrl) {
        payload.url = documentUrl;
      }

      const response = await fetch(`/api/courses/${courseId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const document = await response.json();

      if (response.ok) {
        // Add the new document to the list
        setDocuments(prevDocs => [document, ...prevDocs]);
        
        // Reset form and close modal
        setDocumentTitle('');
        setDocumentContent('');
        setDocumentUrl('');
        setDocumentType('text');
        setShowAddDocumentModal(false);
      } else {
        setError(document.error || 'Failed to create document');
      }
    } catch (err) {
      console.error('Error creating document:', err);
      setError('An error occurred while creating the document');
    } finally {
      setCreating(false);
    }
  };

  const handlePdfUploadComplete = (documentId: string) => {
    // Refresh documents list
    fetch(`/api/courses/${courseId}/documents`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setDocuments(data);
        }
      })
      .catch(err => {
        console.error('Failed to refresh documents:', err);
      });
    
    // Close modal
    setShowAddDocumentModal(false);
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'text':
        return 'Text';
      case 'url':
        return 'URL';
      case 'pdf':
        return 'PDF';
      default:
        return type;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {course && (
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Documents for {course.name}
            </h1>
            <button
              onClick={() => setShowAddDocumentModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Add Document
            </button>
          </div>
          {course.description && (
            <p className="mt-2 text-gray-600">{course.description}</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
          <p className="mt-2 text-gray-600">
            Add documents to your course to help the AI assistant provide better answers.
          </p>
          <button
            onClick={() => setShowAddDocumentModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add a document
          </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {documents.map(doc => (
            <div 
              key={doc.id}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {doc.title}
                </h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  doc.processed 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {doc.processed ? 'Processed' : 'Processing'}
                </span>
              </div>
              <div className="flex mt-2 space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {getDocumentTypeLabel(doc.type)}
                </span>
                <span className="text-gray-500 text-xs">
                  Added: {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
              {doc.type === 'url' && doc.url && (
                <a 
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-500 truncate block"
                >
                  {doc.url}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      {showAddDocumentModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddDocumentModal(false)}></div>
          <div className="relative mt-24 mx-auto max-w-lg p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add a Document</h2>
            
            <div className="mb-4">
              <label htmlFor="documentType" className="block text-gray-700 text-sm font-medium mb-1">
                Document Type
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={e => setDocumentType(e.target.value as 'text' | 'url' | 'pdf')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="pdf">PDF Upload</option>
              </select>
            </div>
            
            {documentType === 'pdf' ? (
              <div className="text-center py-4">
                <PdfUploader 
                  courseId={courseId as string}
                  onUploadComplete={handlePdfUploadComplete}
                />
              </div>
            ) : (
              <form onSubmit={createNewDocument}>
                <div className="mb-4">
                  <label htmlFor="title" className="block text-gray-700 text-sm font-medium mb-1">
                    Document Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={documentTitle}
                    onChange={e => setDocumentTitle(e.target.value)}
                    placeholder="Enter a title for your document"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                {documentType === 'text' && (
                  <div className="mb-4">
                    <label htmlFor="content" className="block text-gray-700 text-sm font-medium mb-1">
                      Document Content
                    </label>
                    <textarea
                      id="content"
                      value={documentContent}
                      onChange={e => setDocumentContent(e.target.value)}
                      placeholder="Enter the document text content"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      rows={6}
                      required
                    />
                  </div>
                )}
                
                {documentType === 'url' && (
                  <div className="mb-4">
                    <label htmlFor="url" className="block text-gray-700 text-sm font-medium mb-1">
                      Document URL
                    </label>
                    <input
                      id="url"
                      type="url"
                      value={documentUrl}
                      onChange={e => setDocumentUrl(e.target.value)}
                      placeholder="Enter the URL for the document (e.g., https://example.com)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddDocumentModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || (!documentTitle || (documentType === 'text' && !documentContent) || (documentType === 'url' && !documentUrl))}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Document'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 