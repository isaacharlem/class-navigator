'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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

export default function CoursesPage() {
  const { data: session } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch('/api/courses');
        
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        
        const data = await response.json();
        setCourses(data);
      } catch (err) {
        setError('Error loading courses. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchCourses();
    }
  }, [session]);

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

      {courses.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">You haven't added any courses yet.</p>
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
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{course.name}</h2>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                  {course.description || 'No description provided'}
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
                  <Link
                    href={`/dashboard/courses/${course.id}/chat`}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Chat
                  </Link>
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