"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    documents: number;
    chats: number;
  };
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

export default function CoursesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch("/api/courses");

        if (!response.ok) {
          throw new Error("Failed to fetch courses");
        }

        const data = await response.json();
        setCourses(data);
      } catch (err) {
        setError("Error loading courses. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchCourses();
    }
  }, [session]);

  // Fetch course chats when the chat modal is opened
  const fetchCourseChats = async (courseId: string) => {
    if (!courseId) return;

    setLoadingChats(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/chat`);
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

  const handleChatClick = (course: Course) => {
    setSelectedCourse(course);
    setShowChatModal(true);
    fetchCourseChats(course.id);
  };

  const createNewChat = () => {
    if (selectedCourse) {
      router.push(`/dashboard/courses/${selectedCourse.id}/chat?forceNew=true`);
    }
  };

  const openExistingChat = (chatId: string) => {
    if (selectedCourse) {
      router.push(`/dashboard/courses/${selectedCourse.id}/chat/${chatId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading courses...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Courses</h1>
        <Link
          href="/dashboard/courses/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Add New Course
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Chat Selection Modal */}
      {showChatModal && selectedCourse && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowChatModal(false)}
          ></div>
          <div className="relative mt-24 mx-auto max-w-lg p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Chat with {selectedCourse.name}
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

      {courses.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">
            You haven't added any courses yet.
          </p>
          <Link
            href="/dashboard/courses/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Your First Course
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-white shadow rounded-lg overflow-hidden"
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {course.name}
                </h2>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                  {course.description || "No description provided"}
                </p>
                <div className="flex gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {course._count.documents} document(s)
                  </div>
                  <div className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    {course._count.chats} chat(s)
                  </div>
                </div>
                <div className="mt-4 space-x-3">
                  <Link
                    href={`/dashboard/courses/${course.id}`}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleChatClick(course)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Chat
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-2 text-xs text-gray-500">
                Updated {new Date(course.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
