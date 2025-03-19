"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ChatUI from "@/components/ChatUI";
import { ChatMessage } from "@/types/types";
import type { Course } from "@prisma/client";

// Define a more specific type that matches the API response
interface CourseWithCounts {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  _count: {
    chats: number;
    documents: number;
  };
}

export default function CourseChat() {
  const params = useParams();
  const searchParams = useSearchParams();
  const forceNew = searchParams.get("forceNew") === "true";

  const router = useRouter();
  const [course, setCourse] = useState<CourseWithCounts | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatCreationAttempted = useRef(false);
  const shouldCleanupChat = useRef(true);
  const hasUsedChat = useRef(false);
  const isNewChat = useRef(forceNew);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(`/api/courses/${params.id}`);

        if (!response.ok) {
          throw new Error("Failed to fetch course details");
        }

        const courseData = await response.json();
        setCourse(courseData);
      } catch (err) {
        setError("Error loading course details. Please try again.");
        console.error(err);
      }
    };

    const createOrFetchChat = async () => {
      // Prevent duplicate chat creation
      if (chatCreationAttempted.current && forceNew) {
        return;
      }

      chatCreationAttempted.current = true;

      try {
        // Create a new general chat or get the most recent one
        const response = await fetch(`/api/courses/${params.id}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "general",
            forceNew: forceNew,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create or fetch chat");
        }

        const chatData = await response.json();
        
        // Set the chatId
        setChatId(chatData.id);
        
        // Determine if this is a new or existing chat based on message count
        const isExistingChat = chatData._count?.messages > 0;
        
        // For existing chats, don't attempt cleanup
        if (isExistingChat) {
          console.log(`Found existing general chat with ${chatData._count.messages} messages`);
          shouldCleanupChat.current = false;
          hasUsedChat.current = true;
          isNewChat.current = false;
        } else {
          console.log(`Created new empty general chat: ${chatData.id}`);
          shouldCleanupChat.current = true;
          isNewChat.current = true;
        }

        // Fetch messages if the chat exists
        if (chatData.id) {
          const messagesResponse = await fetch(
            `/api/chat/${chatData.id}/messages`,
          );

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            setMessages(messagesData);
            
            // Double-check: if chat has messages, don't delete it when leaving
            if (messagesData.length > 0) {
              shouldCleanupChat.current = false;
              hasUsedChat.current = true;
            }
          }
        }
      } catch (err) {
        setError("Error setting up chat. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    const setup = async () => {
      await fetchCourse();
      await createOrFetchChat();
    };

    if (params.id) {
      setup();
    }

    // Cleanup function for component unmount
    return () => {
      chatCreationAttempted.current = false;
      
      // Only attempt to delete the chat if:
      // 1. It should be cleaned up (no messages sent)
      // 2. We have a chatId
      // 3. No messages were sent during this session
      // 4. This was a newly created chat (not a reused one)
      if (shouldCleanupChat.current && chatId && !hasUsedChat.current && isNewChat.current) {
        console.log(`Cleaning up empty general chat: ${chatId}`);
        fetch(`/api/chat/${chatId}/empty`, {
          method: "DELETE",
        }).catch(error => {
          console.error("Error cleaning up empty chat:", error);
        });
      }
    };
  }, [params.id, forceNew, chatId]);

  // Disable cleanup when a message is sent successfully
  const handleSaveChat = () => {
    console.log("Chat saved, disabling cleanup");
    shouldCleanupChat.current = false;
    hasUsedChat.current = true;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Setting up your chat...</p>
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

  if (!chatId) {
    return (
      <div className="bg-red-50 border border-red-500 text-red-700 px-4 py-3 rounded">
        Failed to create chat session. Please try again.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link
            href={`/dashboard/courses/${params.id}`}
            className="text-blue-600 hover:underline flex items-center"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to {course.name}
          </Link>
        </div>
        <div className="flex space-x-3">
          <Link
            href={`/dashboard/courses/${params.id}/chats`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            View All Chats
          </Link>
          <Link
            href={`/dashboard/courses/${params.id}/chat/new?type=assignment`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Create Assignment Chat
          </Link>
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-lg h-full overflow-hidden border">
        {chatId && (
          <ChatUI
            chatId={chatId}
            courseId={params.id as string}
            initialMessages={messages}
            onSaveChat={handleSaveChat}
          />
        )}
      </div>
    </div>
  );
}
