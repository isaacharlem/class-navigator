"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  citations?: Citation[];
  createdAt: string;
}

interface Citation {
  id: string;
  documentId: string;
  sourceText: string;
}

interface Chat {
  id: string;
  title: string;
  type: string;
  course: {
    id: string;
    name: string;
  };
}

export default function ChatPage() {
  const { id, chatId } = useParams();
  const courseId = Array.isArray(id) ? id[0] : id;
  const chatIdValue = Array.isArray(chatId) ? chatId[0] : chatId;

  const router = useRouter();
  const { data: session, status } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldCleanupChat = useRef(false); // Default false since we're loading an existing chat
  const hasInteracted = useRef(false);

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Chat options
  const [enableCitations, setEnableCitations] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(false);

  // Fetch chat and messages
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated" && chatIdValue) {
      // Fetch chat details
      fetch(`/api/chat/${chatIdValue}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch chat");
          return res.json();
        })
        .then((data) => {
          setChat(data);
          return fetch(`/api/chat/${chatIdValue}/messages`);
        })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch messages");
          return res.json();
        })
        .then((data) => {
          setMessages(data);
          // If we loaded the chat and there are no messages, enable cleanup
          if (data.length === 0) {
            shouldCleanupChat.current = true;
            console.log(`Chat ${chatIdValue} has no messages, will check for deletion on unmount`);
          } else {
            shouldCleanupChat.current = false;
          }
          setLoading(false);
          scrollToBottom();
        })
        .catch((err) => {
          console.error("Error fetching chat data:", err);
          setError("Failed to load chat data");
          setLoading(false);
        });
    }

    // Cleanup function for empty chats
    return () => {
      if (shouldCleanupChat.current && chatIdValue) {
        console.log(`Page unmounting, checking if chat ${chatIdValue} is empty and should be deleted`);
        fetch(`/api/chat/${chatIdValue}/empty`, {
          method: "DELETE",
        }).catch(error => {
          console.error("Error cleaning up empty chat:", error);
        });
      }
    };
  }, [chatIdValue, router, status]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    // Mark that user has interacted with the chat
    hasInteracted.current = true;
    shouldCleanupChat.current = false;

    setSending(true);
    setError("");

    const userMessage = {
      id: "temp-" + Date.now(),
      content: newMessage,
      role: "user" as const,
      createdAt: new Date().toISOString(),
    };

    // Add user message immediately to the UI
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");

    try {
      // Send message to API
      const response = await fetch(`/api/chat/${chatIdValue}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          options: {
            enableCitations,
            enableWebSearch,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const aiResponse = await response.json();

      // Add AI response to messages
      setMessages((prev) => [
        ...prev,
        {
          id: aiResponse.id,
          content: aiResponse.content,
          role: "assistant",
          citations: aiResponse.citations,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Chat header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {chat?.title}
            </h1>
            {chat?.course && (
              <p className="text-sm text-gray-600">
                Course: {chat.course.name}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setEnableCitations(!enableCitations)}
              className={`px-3 py-1 text-sm rounded-md ${
                enableCitations
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {enableCitations ? "Citations: On" : "Citations: Off"}
            </button>
            <button
              onClick={() => setEnableWebSearch(!enableWebSearch)}
              className={`px-3 py-1 text-sm rounded-md ${
                enableWebSearch
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {enableWebSearch ? "Web Search: On" : "Web Search: Off"}
            </button>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium text-gray-900">
              No messages yet
            </h3>
            <p className="mt-1 text-gray-600">
              Start the conversation by asking a question about your course
              materials.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg max-w-3xl ${
                  message.role === "user"
                    ? "bg-indigo-100 ml-auto"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div className="text-gray-900">{message.content}</div>

                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Sources:
                    </p>
                    <div className="space-y-1">
                      {message.citations.map((citation, index) => {
                        // Display the actual source text without replacement
                        return (
                          <details
                            key={citation.id}
                            className="text-xs bg-gray-50 rounded"
                          >
                            <summary className="p-2 cursor-pointer hover:bg-gray-100 flex items-center">
                              <span className="font-medium">
                                Source {index + 1}
                              </span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3 w-3 ml-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </summary>
                            <div className="p-2 bg-gray-100 rounded-b">
                              <p className="font-medium mb-1">
                                Quoted content:
                              </p>

                              {citation.sourceText.includes(
                                "system found this document relevant, but actual content is not available",
                              ) ? (
                                <div className="p-2 bg-red-50 border-l-2 border-red-500">
                                  <p className="text-red-700">
                                    {citation.sourceText}
                                  </p>
                                  <div className="mt-2 flex flex-col">
                                    <p className="text-gray-600 italic mb-2">
                                      The document needs to be reprocessed to
                                      extract its content.
                                    </p>
                                    <div className="flex justify-end space-x-2">
                                      <button
                                        onClick={async () => {
                                          try {
                                            const response = await fetch(
                                              `/api/documents/${citation.documentId}/process`,
                                              {
                                                method: "POST",
                                              },
                                            );
                                            if (response.ok) {
                                              alert(
                                                "Document reprocessing started. Please try your query again in a few moments.",
                                              );
                                            } else {
                                              alert(
                                                "Failed to reprocess document. Please try again later.",
                                              );
                                            }
                                          } catch (error) {
                                            console.error(
                                              "Error reprocessing document:",
                                              error,
                                            );
                                            alert(
                                              "Error reprocessing document. Please try again later.",
                                            );
                                          }
                                        }}
                                        className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
                                      >
                                        Reprocess Document
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (
                                            window.confirm(
                                              "Are you sure you want to delete this document? This cannot be undone.",
                                            )
                                          ) {
                                            try {
                                              const response = await fetch(
                                                `/api/documents/${citation.documentId}`,
                                                {
                                                  method: "DELETE",
                                                },
                                              );
                                              if (response.ok) {
                                                alert(
                                                  "Document deleted successfully. You can now upload it again.",
                                                );
                                              } else {
                                                alert(
                                                  "Failed to delete document. Please try again later.",
                                                );
                                              }
                                            } catch (error) {
                                              console.error(
                                                "Error deleting document:",
                                                error,
                                              );
                                              alert(
                                                "Error deleting document. Please try again later.",
                                              );
                                            }
                                          }
                                        }}
                                        className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs"
                                      >
                                        Delete Document
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : citation.sourceText.includes(
                                  "because of the new implementation with openai assistant",
                                ) ? (
                                <div className="p-2 bg-orange-50 border-l-2 border-orange-500">
                                  <p className="text-gray-700 whitespace-pre-wrap">
                                    {citation.sourceText}
                                  </p>
                                  <div className="mt-2 flex flex-col">
                                    <p className="text-gray-600 italic mb-2">
                                      This document is being processed with the
                                      OpenAI Assistant API.
                                    </p>
                                    <div className="flex justify-end space-x-2">
                                      <button
                                        onClick={async () => {
                                          try {
                                            const response = await fetch(
                                              `/api/documents/${citation.documentId}/process`,
                                              {
                                                method: "POST",
                                              },
                                            );
                                            if (response.ok) {
                                              alert(
                                                "Document reprocessing started. Please try your query again in a few moments.",
                                              );
                                            } else {
                                              alert(
                                                "Failed to reprocess document. Please try again later.",
                                              );
                                            }
                                          } catch (error) {
                                            console.error(
                                              "Error reprocessing document:",
                                              error,
                                            );
                                            alert(
                                              "Error reprocessing document. Please try again later.",
                                            );
                                          }
                                        }}
                                        className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
                                      >
                                        Reprocess Document
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (
                                            window.confirm(
                                              "Are you sure you want to delete this document? This cannot be undone.",
                                            )
                                          ) {
                                            try {
                                              const response = await fetch(
                                                `/api/documents/${citation.documentId}`,
                                                {
                                                  method: "DELETE",
                                                },
                                              );
                                              if (response.ok) {
                                                alert(
                                                  "Document deleted successfully. You can now upload it again.",
                                                );
                                              } else {
                                                alert(
                                                  "Failed to delete document. Please try again later.",
                                                );
                                              }
                                            } catch (error) {
                                              console.error(
                                                "Error deleting document:",
                                                error,
                                              );
                                              alert(
                                                "Error deleting document. Please try again later.",
                                              );
                                            }
                                          }
                                        }}
                                        className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs"
                                      >
                                        Delete Document
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 bg-yellow-50 border-l-2 border-yellow-500 italic">
                                  <p className="text-gray-600 whitespace-pre-wrap">
                                    {citation.sourceText}
                                  </p>
                                  <div className="flex justify-end mt-2">
                                    <button
                                      onClick={async () => {
                                        if (
                                          window.confirm(
                                            "Are you sure you want to delete this document? This cannot be undone.",
                                          )
                                        ) {
                                          try {
                                            const response = await fetch(
                                              `/api/documents/${citation.documentId}`,
                                              {
                                                method: "DELETE",
                                              },
                                            );
                                            if (response.ok) {
                                              alert(
                                                "Document deleted successfully. You can now upload it again.",
                                              );
                                            } else {
                                              alert(
                                                "Failed to delete document. Please try again later.",
                                              );
                                            }
                                          } catch (error) {
                                            console.error(
                                              "Error deleting document:",
                                              error,
                                            );
                                            alert(
                                              "Error deleting document. Please try again later.",
                                            );
                                          }
                                        }
                                      }}
                                      className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs"
                                    >
                                      Delete Document
                                    </button>
                                  </div>
                                </div>
                              )}

                              <p className="text-right mt-1 text-gray-500">
                                Document ID: {citation.documentId}
                              </p>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-right mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
