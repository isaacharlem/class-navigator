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
  content?: string | null;
}

interface Chat {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
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
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [selectedTextDocument, setSelectedTextDocument] =
    useState<Document | null>(null);
  const [loadingDocumentContent, setLoadingDocumentContent] = useState(false);

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

  // Fetch course chats when the chat modal is opened
  const fetchCourseChats = async () => {
    if (!params.id) return;

    setLoadingChats(true);
    try {
      const res = await fetch(`/api/courses/${params.id}/chat`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch course chats:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleChatClick = () => {
    setShowChatModal(true);
    fetchCourseChats();
  };

  const createNewChat = () => {
    router.push(`/dashboard/courses/${params.id}/chat?forceNew=true`);
  };

  const openExistingChat = (chatId: string) => {
    router.push(`/dashboard/courses/${params.id}/chat/${chatId}`);
  };

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

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      window.confirm(
        "Are you sure you want to delete this document? This action cannot be undone.",
      )
    ) {
      try {
        const response = await fetch(`/api/documents/${docId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          // Remove the document from the documents list
          setDocuments(documents.filter((doc) => doc.id !== docId));
        } else {
          console.error("Failed to delete document");
          setError("Failed to delete document. Please try again.");
        }
      } catch (err) {
        console.error("Error deleting document:", err);
        setError("Error deleting document. Please try again.");
      }
    }
  };

  const handleDocumentClick = (doc: Document) => {
    if (doc.type === "pdf") {
      // For PDFs, create a file URL and open in new tab
      const fileUrl = `/api/documents/${doc.id}/file`;
      console.log("Opening PDF document with ID:", doc.id);

      // First try to fetch to check if the document is available
      fetch(fileUrl)
        .then((response) => {
          if (response.ok) {
            // If document is available, open in new tab
            window.open(fileUrl, "_blank");
          } else {
            // If there's an error, parse the JSON response
            return response.json().then((errorData) => {
              throw new Error(
                errorData.message || "Failed to load PDF document",
              );
            });
          }
        })
        .catch((error) => {
          console.error("Error opening PDF:", error);
          alert(
            error.message ||
              "Failed to load PDF document. The file may not be available.",
          );
        });
    } else if (doc.type === "text") {
      // For text documents, show in a dialog
      setSelectedTextDocument(doc);
      setShowTextDialog(true);
    } else if (doc.url) {
      // For URL documents, open the URL directly
      console.log("Opening document with URL:", doc.url);
      window.open(doc.url, "_blank");
    } else {
      console.error("Document has no URL and is not a PDF:", doc);
      // Show an error message to the user
      alert(
        "This document cannot be opened. It may still be processing or the file is unavailable.",
      );
    }
  };

  const closeTextDialog = () => {
    setShowTextDialog(false);
    setSelectedTextDocument(null);
  };

  const fetchDocumentContent = async (docId: string) => {
    if (!docId) return;

    setLoadingDocumentContent(true);
    try {
      const response = await fetch(`/api/documents/${docId}`);
      if (response.ok) {
        const data = await response.json();
        // Update the selected document with its content
        setSelectedTextDocument((prev) =>
          prev ? { ...prev, content: data.content } : null,
        );
      } else {
        console.error("Failed to fetch document content");
      }
    } catch (err) {
      console.error("Error fetching document content:", err);
    } finally {
      setLoadingDocumentContent(false);
    }
  };

  // Fetch content when a text document is selected
  useEffect(() => {
    if (
      selectedTextDocument &&
      selectedTextDocument.type === "text" &&
      !selectedTextDocument.content
    ) {
      fetchDocumentContent(selectedTextDocument.id);
    }
  }, [selectedTextDocument]);

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
          <button
            onClick={handleChatClick}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Chat with AI
          </button>
        </div>
      </div>

      {/* Chat Selection Modal */}
      {showChatModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowChatModal(false)}
          ></div>
          <div className="relative mt-24 mx-auto max-w-lg p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Chat with Course AI
            </h2>

            <div className="space-y-4">
              <button
                onClick={createNewChat}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
              >
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-600 mr-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">Create a new chat</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-indigo-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <div>
                <h3 className="text-md font-medium text-gray-700 mb-2">
                  Continue an existing chat
                </h3>

                {loadingChats ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto"></div>
                  </div>
                ) : chats.length === 0 ? (
                  <p className="text-sm text-gray-500 py-3">
                    No existing chats found
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    <ul className="space-y-2">
                      {chats.map((chat) => (
                        <li key={chat.id}>
                          <button
                            onClick={() => openExistingChat(chat.id)}
                            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 rounded-md transition"
                          >
                            <div className="flex items-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-gray-400 mr-3"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="text-left">
                                <span className="block font-medium text-gray-800">
                                  {chat.title}
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {new Date(
                                    chat.updatedAt,
                                  ).toLocaleDateString()}{" "}
                                  • {chat._count?.messages || 0} messages
                                </span>
                              </div>
                            </div>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-gray-400"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowChatModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Document Dialog */}
      {showTextDialog && selectedTextDocument && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={closeTextDialog}
          ></div>
          <div className="relative mt-8 mx-auto max-w-5xl p-4 bg-white rounded-lg shadow-xl h-5/6 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedTextDocument.title || selectedTextDocument.name}
              </h2>
              <button
                onClick={closeTextDialog}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-grow overflow-auto">
              {loadingDocumentContent ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-gray-50 rounded">
                  {selectedTextDocument.content ||
                    "This document's content is not available."}
                </pre>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={closeTextDialog}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <li
                    key={doc.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleDocumentClick(doc)}
                  >
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
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          )}
                          <button
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            className="text-red-500 hover:text-red-700 transition"
                            aria-label="Delete document"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
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
              New Assignment Chat
            </Link>

            <div className="mt-4">
              <Link
                href={`/dashboard/chats`}
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
