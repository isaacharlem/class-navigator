"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CourseWithChatCount, DocumentModel } from "@/types/types";

interface Document {
  id: string;
  name: string;
  title?: string;
  type: string;
  url?: string | null;
  createdAt: string;
  processed?: boolean;
}

// Define extended course type to match what we get from the API
interface ExtendedCourse extends CourseWithChatCount {
  name: string;
  description: string | null;
  id: string;
  createdAt: string;
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<ExtendedCourse | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = async () => {
    try {
      const [courseRes, docsRes] = await Promise.all([
        fetch(`/api/courses/${params.id}`),
        fetch(`/api/courses/${params.id}/documents`),
      ]);

      if (!courseRes.ok) {
        throw new Error("Failed to fetch course details");
      }

      const courseData = await courseRes.json();
      setCourse(courseData as ExtendedCourse);

      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      }
    } catch (err) {
      setError("Error loading course details. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchCourse();
    }
  }, [params.id]);

  // Poll for document processing status updates
  useEffect(() => {
    // Only start polling if we have documents and at least one is still processing
    const hasProcessingDocuments = documents.some(
      (doc: Document) => doc.processed === false,
    );

    if (!hasProcessingDocuments || documents.length === 0) {
      return;
    }

    // Set up polling every 5 seconds
    const pollInterval = setInterval(() => {
      // Only fetch documents, not the whole course
      fetch(`/api/courses/${params.id}/documents`)
        .then((res) => res.json())
        .then((data) => {
          setDocuments(data);
          // If all documents are processed, stop polling
          if (!data.some((doc: Document) => doc.processed === false)) {
            clearInterval(pollInterval);
          }
        })
        .catch((err) => {
          console.error("Error polling for document updates:", err);
        });
    }, 5000);

    // Clean up the interval on component unmount
    return () => clearInterval(pollInterval);
  }, [params.id, documents]);

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this course? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/courses/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete course");
      }

      router.push("/dashboard/courses");
      router.refresh();
    } catch (err) {
      setError("Error deleting course. Please try again.");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded">
        {error || "Course not found"}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {course.name}
          </h1>
          <p className="text-gray-500">
            {course.description || "No description"}
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <Link
            href={`/dashboard/courses/${course.id}/edit`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            Delete
          </button>
          <Link
            href={`/dashboard/courses/${course.id}/chat`}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Chat with AI
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Documents section */}
        <div className="md:col-span-2">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Course Documents
              </h2>
              <Link
                href={`/dashboard/courses/${course.id}/upload`}
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Upload Document
              </Link>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 mb-4">
                  No documents have been uploaded for this course yet.
                </p>
                <Link
                  href={`/dashboard/courses/${course.id}/upload`}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Upload Your First Document
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li key={doc.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 mr-3">
                          {doc.type === "pdf" && (
                            <svg
                              className="h-6 w-6 text-red-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {doc.type === "url" && (
                            <svg
                              className="h-6 w-6 text-blue-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {doc.type === "text" && (
                            <svg
                              className="h-6 w-6 text-gray-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {doc.title || doc.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(doc.createdAt).toLocaleDateString()} •{" "}
                            {doc.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* Document processing status indicator */}
                        {doc.processed === false && (
                          <span className="inline-flex items-center">
                            <svg
                              className="animate-spin h-4 w-4 text-yellow-500 mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            <span className="text-xs text-yellow-600">
                              Processing
                            </span>
                          </span>
                        )}
                        {doc.processed === true && (
                          <span className="inline-flex items-center">
                            <svg
                              className="h-4 w-4 text-green-500 mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-xs text-green-600">
                              Processed
                            </span>
                          </span>
                        )}
                        <div className="flex space-x-2">
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View
                            </a>
                          )}
                          <button
                            onClick={() => {
                              // Handle delete document
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Stats and chats section */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Course Statistics
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Documents</p>
                <p className="text-xl font-semibold">{documents.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Chats</p>
                <p className="text-xl font-semibold">
                  {course._count?.chats || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="text-md">
                  {new Date(course.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Chats
            </h2>
            <Link
              href={`/dashboard/courses/${course.id}/chat/new`}
              className="w-full mb-4 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              New Chat
            </Link>

            <div className="mt-4">
              <Link
                href={`/dashboard/courses/${course.id}/chats`}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                View all chats
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
