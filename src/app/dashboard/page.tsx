'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  name: string;
  description: string | null;
  _count?: {
    chats: number;
    documents: number;
  };
}

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
  course: {
    id: string;
    name: string;
  };
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentCount, setDocumentCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  useEffect(() => {
    if (session?.user) {
      // Fetch courses
      fetch('/api/courses')
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setCourses(data);
            
            // Calculate total document count
            let docs = 0;
            data.forEach((course: Course) => {
              if (course._count?.documents) {
                docs += course._count.documents;
              }
            });
            setDocumentCount(docs);
            
            // Calculate total chat count
            let chats = 0;
            data.forEach((course: Course) => {
              if (course._count?.chats) {
                chats += course._count.chats;
              }
            });
            setChatCount(chats);
          }
        })
        .catch(error => {
          console.error('Error fetching courses:', error);
        });
      
      // Fetch recent chats
      fetch('/api/chats/recent?limit=5')
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setRecentChats(data);
          }
        })
        .catch(error => {
          console.error('Error fetching chats:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="ml-2 text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome, {session?.user?.name || 'User'}</p>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Courses</h3>
            <p className="text-3xl font-bold text-blue-600">{courses.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Documents</h3>
            <p className="text-3xl font-bold text-green-600">{documentCount}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <h3 className="text-lg font-semibold text-purple-900">Chats</h3>
            <p className="text-3xl font-bold text-purple-600">{chatCount}</p>
          </div>
        </div>
      </div>

      {/* Recent chats */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Chats</h2>
          <Link href="/dashboard/chats" className="text-blue-600 hover:underline text-sm">
            View all
          </Link>
        </div>

        {recentChats.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent chats found.</p>
        ) : (
          <div className="space-y-4">
            {recentChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/dashboard/courses/${chat.course.id}/chat/${chat.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-900">{chat.title}</h3>
                    <p className="text-sm text-gray-500">{chat.course.name}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Courses */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Courses</h2>
          <Link href="/dashboard/courses" className="text-blue-600 hover:underline text-sm">
            View all
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't added any courses yet.</p>
            <Link
              href="/dashboard/courses/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Add Your First Course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <h3 className="font-medium text-gray-900">{course.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mt-1">{course.description || 'No description'}</p>
                <div className="mt-2 text-xs text-gray-400">
                  {course._count?.chats || 0} chat{(course._count?.chats || 0) !== 1 ? 's' : ''}
                  {' • '}
                  {course._count?.documents || 0} document{(course._count?.documents || 0) !== 1 ? 's' : ''}
                </div>
              </Link>
            ))}
            <Link
              href="/dashboard/courses/new"
              className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 h-full"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="h-8 w-8 text-gray-400 mb-2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium text-gray-900">Add New Course</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 