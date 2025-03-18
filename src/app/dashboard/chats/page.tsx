'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    name: string;
  };
}

export default function ChatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetch('/api/chats/recent')
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch chats');
          }
          return response.json();
        })
        .then(data => {
          setChats(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching chats:', err);
          setError('Failed to load chats. Please try again later.');
          setLoading(false);
        });
    } else if (status === 'loading') {
      // Still loading session, do nothing yet
    }
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-gray-600">Loading chats...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Chats</h1>
        <p className="text-gray-600 mt-1">Access all your course conversations</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          {error}
        </div>
      )}

      {chats.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No chats yet</h3>
          <p className="mt-1 text-gray-500">Start a conversation in one of your courses</p>
          <div className="mt-6">
            <Link
              href="/dashboard/courses"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Courses
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/dashboard/courses/${chat.course.id}/chat/${chat.id}`}
                  className="block hover:bg-gray-50 transition"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        <p className="text-lg font-medium text-indigo-600 truncate">{chat.title}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Course: {chat.course.name}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 