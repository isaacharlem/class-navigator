'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Chat {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

interface Course {
  id: string;
  name: string;
  description?: string;
}

export default function CourseChats() {
  const { id } = useParams();
  const courseId = Array.isArray(id) ? id[0] : id;
  
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatType, setNewChatType] = useState('general');
  const [assignmentName, setAssignmentName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated' && courseId) {
      // Fetch course details
      fetch(`/api/courses/${courseId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setCourse(data);
          }
        })
        .catch(err => {
          console.error('Failed to fetch course:', err);
          setError('Failed to fetch course');
        });

      // Fetch course chats
      fetch(`/api/courses/${courseId}/chat`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setChats(data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch chats:', err);
          setError('Failed to fetch chats');
          setLoading(false);
        });
    }
  }, [courseId, router, status]);

  const createNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const payload: any = {
        type: newChatType,
      };
      
      // Only include title if it's provided and not empty
      if (newChatTitle.trim()) {
        payload.title = newChatTitle;
      }
      
      // Include assignment name for assignment-type chats
      if (newChatType === 'assignment' && assignmentName) {
        payload.assignmentName = assignmentName;
      }
      
      // Include first message if provided
      if (firstMessage.trim()) {
        payload.firstMessage = firstMessage;
      }

      const response = await fetch(`/api/courses/${courseId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const chat = await response.json();

      if (response.ok) {
        // Add the new chat to the list
        setChats(prevChats => [chat, ...prevChats]);
        
        // Reset form and close modal
        setNewChatTitle('');
        setNewChatType('general');
        setAssignmentName('');
        setFirstMessage('');
        setShowNewChatModal(false);
        
        // Navigate to the new chat
        router.push(`/dashboard/courses/${courseId}/chat/${chat.id}`);
      } else {
        setError(chat.error || 'Failed to create chat');
      }
    } catch (err) {
      console.error('Error creating chat:', err);
      setError('An error occurred while creating the chat');
    } finally {
      setCreating(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading chats...</p>
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
              Chats for {course.name}
            </h1>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              New Chat
            </button>
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

      {chats.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No chats yet</h3>
          <p className="mt-2 text-gray-600">
            Create a new chat to start asking questions about your course materials.
          </p>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create a chat
          </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {chats.map(chat => (
            <Link 
              href={`/dashboard/courses/${courseId}/chat/${chat.id}`} 
              key={chat.id}
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {chat.title}
                </h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  chat.type === 'general' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {chat.type}
                </span>
              </div>
              <p className="mt-1 text-gray-600 text-sm">
                {chat._count.messages} message{chat._count.messages !== 1 ? 's' : ''}
              </p>
              <p className="mt-2 text-gray-500 text-xs">
                Last updated: {new Date(chat.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowNewChatModal(false)}></div>
          <div className="relative mt-24 mx-auto max-w-lg p-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create a New Chat</h2>
            
            <form onSubmit={createNewChat}>
              <div className="mb-4">
                <label htmlFor="title" className="block text-gray-700 text-sm font-medium mb-1">
                  Chat Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={newChatTitle}
                  onChange={e => setNewChatTitle(e.target.value)}
                  placeholder="Enter a title for your chat"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required={newChatType !== 'general'}
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="type" className="block text-gray-700 text-sm font-medium mb-1">
                  Chat Type
                </label>
                <select
                  id="type"
                  value={newChatType}
                  onChange={e => setNewChatType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="general">General</option>
                  <option value="assignment">Assignment</option>
                </select>
              </div>
              
              {newChatType === 'assignment' && (
                <div className="mb-4">
                  <label htmlFor="assignmentName" className="block text-gray-700 text-sm font-medium mb-1">
                    Assignment Name
                  </label>
                  <input
                    id="assignmentName"
                    type="text"
                    value={assignmentName}
                    onChange={e => setAssignmentName(e.target.value)}
                    placeholder="Enter the assignment name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              )}
              
              {newChatType === 'general' && (
                <div className="mb-4">
                  <label htmlFor="firstMessage" className="block text-gray-700 text-sm font-medium mb-1">
                    First Message (Optional)
                  </label>
                  <textarea
                    id="firstMessage"
                    value={firstMessage}
                    onChange={e => setFirstMessage(e.target.value)}
                    placeholder="Type an initial message to start the chat"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    A descriptive first message helps generate a better chat title
                  </p>
                </div>
              )}
              
              {newChatType === 'assignment' && (
                <div className="mb-4">
                  <label htmlFor="firstMessage" className="block text-gray-700 text-sm font-medium mb-1">
                    First Message (Optional)
                  </label>
                  <textarea
                    id="firstMessage"
                    value={firstMessage}
                    onChange={e => setFirstMessage(e.target.value)}
                    placeholder="Type an initial message about this assignment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                  />
                </div>
              )}
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || (newChatType === 'assignment' && !assignmentName)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 