"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Course {
  id: string;
  name: string;
  description?: string;
}

export default function NewChat() {
  const params = useParams();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const searchParams = useSearchParams();
  const chatType = searchParams.get("type") || "assignment";

  const router = useRouter();
  const { data: session, status } = useSession();

  const [course, setCourse] = useState<Course | null>(null);
  const [assignmentName, setAssignmentName] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated" && courseId) {
      // Fetch course details
      fetch(`/api/courses/${courseId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setCourse(data);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch course:", err);
          setError("Failed to fetch course");
        });
    }
  }, [courseId, router, status]);

  const createChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const payload: any = {
        type: "assignment",
      };

      // Include assignment name
      if (assignmentName.trim()) {
        payload.assignmentName = assignmentName;
      } else {
        setError("Assignment name is required");
        setCreating(false);
        return;
      }

      // Include first message if provided
      if (firstMessage.trim()) {
        payload.firstMessage = firstMessage;
      }

      const response = await fetch(`/api/courses/${courseId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const chat = await response.json();

      if (response.ok) {
        // Navigate to the new chat
        router.push(`/dashboard/courses/${courseId}/chat/${chat.id}`);
      } else {
        setError(chat.error || "Failed to create chat");
      }
    } catch (err) {
      console.error("Error creating chat:", err);
      setError("An error occurred while creating the chat");
    } finally {
      setCreating(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
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
              Create New Assignment Chat for {course.name}
            </h1>
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

      <div className="bg-white shadow-lg rounded-lg p-6">
        <form onSubmit={createChat}>
          <div className="mb-4">
            <label
              htmlFor="assignmentName"
              className="block text-gray-700 text-sm font-medium mb-1"
            >
              Assignment Name*
            </label>
            <input
              id="assignmentName"
              type="text"
              value={assignmentName}
              onChange={(e) => setAssignmentName(e.target.value)}
              placeholder="Enter the assignment name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="firstMessage"
              className="block text-gray-700 text-sm font-medium mb-1"
            >
              First Message (Optional)
            </label>
            <textarea
              id="firstMessage"
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder="Type an initial message about this assignment"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
          </div>

          <div className="flex justify-between space-x-3 mt-6">
            <Link
              href={`/dashboard/courses/${courseId}/chats`}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={creating || !assignmentName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Assignment Chat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
