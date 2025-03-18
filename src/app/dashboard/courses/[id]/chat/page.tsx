'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatUI from '@/components/ChatUI';
import { CourseWithChatCount, ChatMessage } from '@/types/types';

export default function CourseChat() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseWithChatCount | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      }
    };

    const createOrFetchChat = async () => {
      try {
        // Create a new general chat or get the most recent one
        const response = await fetch(`/api/courses/${params.id}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `Chat with ${course?.name || 'Course'}`,
            type: 'general',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create or fetch chat');
        }

        const chatData = await response.json();
        setChatId(chatData.id);

        // Fetch messages if the chat already exists
        if (chatData.id && chatData._count?.messages > 0) {
          const messagesResponse = await fetch(`/api/chat/${chatData.id}/messages`);
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            setMessages(messagesData);
          }
        }
      } catch (err) {
        setError('Error setting up chat. Please try again.');
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
  }, [params.id, course?.name]);

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
        {error || 'Course not found'}
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
          />
        )}
      </div>
    </div>
  );
} 