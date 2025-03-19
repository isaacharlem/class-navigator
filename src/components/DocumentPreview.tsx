import React, { useState, useEffect } from "react";

interface DocumentPreviewProps {
  document: {
    id: string;
    name: string;
    title?: string;
    type: string;
    url?: string | null;
  };
  onClose: () => void;
}

export default function DocumentPreview({
  document,
  onClose,
}: DocumentPreviewProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch text content for text documents
  useEffect(() => {
    if (document.type === "text" && document.url) {
      setIsLoading(true);
      setError(null);

      fetch(document.url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to fetch document: ${response.status} ${response.statusText}`,
            );
          }
          return response.text();
        })
        .then((content) => {
          setTextContent(content);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching text document:", err);
          setError(
            "Failed to load document content. Please try opening it in a new tab.",
          );
          setIsLoading(false);
        });
    }
  }, [document]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500">Loading document...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-red-500">{error}</p>
        </div>
      );
    }

    if (document.type === "pdf" && document.url) {
      return (
        <div className="h-full flex flex-col">
          <div className="bg-gray-100 p-3 mb-2 rounded flex justify-center">
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Open PDF in New Tab
            </a>
          </div>
          <div className="flex-grow">
            <iframe
              src={document.url}
              className="w-full h-full border-0"
              title={document.title || document.name}
            />
          </div>
        </div>
      );
    }

    if (document.type === "text") {
      return (
        <div className="overflow-auto h-full p-4 bg-gray-50 rounded">
          {textContent ? (
            <pre className="whitespace-pre-wrap font-mono text-sm">
              {textContent}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No content available</p>
            </div>
          )}
        </div>
      );
    }

    if (document.type === "url" && document.url) {
      return (
        <iframe
          src={document.url}
          className="w-full h-full border-0"
          title={document.title || document.name}
        />
      );
    }

    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">This document type can't be previewed</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      ></div>
      <div className="relative mt-8 mx-auto max-w-5xl p-4 bg-white rounded-lg shadow-xl h-5/6 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {document.title || document.name}
          </h2>
          <button
            onClick={onClose}
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

        <div className="flex-grow overflow-hidden">{renderContent()}</div>

        <div className="mt-4 flex justify-end">
          {document.url && document.type !== "pdf" && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 mr-3"
            >
              Open in New Tab
            </a>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
