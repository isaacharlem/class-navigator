'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessage, AIChatOptions, Citation } from '@/types/types';

interface ChatUIProps {
  chatId: string;
  courseId: string;
  initialMessages?: ChatMessage[];
  onSaveChat?: () => void;
}

export default function ChatUI({ chatId, courseId, initialMessages = [], onSaveChat }: ChatUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<AIChatOptions>({
    enableWebSearch: true,
    enableCitations: true,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
    };

    // Add user message to the chat
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message to API
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      // Add assistant message to the chat
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.content,
        citations: data.citations,
      }]);

      // Call onSaveChat to update parent if needed
      if (onSaveChat) {
        onSaveChat();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOption = (option: keyof AIChatOptions) => {
    setOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-3 bg-white border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Course Assistant</h2>
          <p className="text-sm text-gray-500">
            Ask questions about your course materials
          </p>
        </div>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => toggleOption('enableCitations')}
            className={`px-3 py-1 text-xs rounded-full ${
              options.enableCitations 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {options.enableCitations ? 'Citations On' : 'Citations Off'}
          </button>
          <button
            type="button"
            onClick={() => toggleOption('enableWebSearch')}
            className={`px-3 py-1 text-xs rounded-full ${
              options.enableWebSearch 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {options.enableWebSearch ? 'Web Search On' : 'Web Search Off'}
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 my-8">
            <p className="mb-2">No messages yet</p>
            <p className="text-sm">
              Start by asking a question about your course materials
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Display citations if they exist */}
                {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Sources:</p>
                    <ul className="space-y-1">
                      {message.citations.map((citation, i) => {
                        // Instead of replacing with generic placeholder, preserve the actual source text
                        return (
                          <li key={i} className="text-xs text-gray-600">
                            <details className="bg-gray-50 rounded">
                              <summary className="p-2 cursor-pointer hover:bg-gray-100 flex items-center">
                                <span className="font-medium">Source {i + 1}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </summary>
                              <div className="bg-gray-100 p-2 rounded text-xs">
                                <p className="font-medium mb-1">Quoted content:</p>
                                
                                {citation.sourceText.includes('system found this document relevant, but actual content is not available') ? (
                                  <div className="p-2 bg-red-50 border-l-2 border-red-500">
                                    <p className="text-red-700">
                                      {citation.sourceText}
                                    </p>
                                    <div className="mt-2 flex flex-col">
                                      <p className="text-gray-600 italic mb-2">
                                        The document needs to be reprocessed to extract its content.
                                      </p>
                                      <div className="flex justify-end space-x-2">
                                        <button
                                          onClick={async () => {
                                            try {
                                              const response = await fetch(`/api/documents/${citation.documentId}/process`, {
                                                method: 'POST',
                                              });
                                              if (response.ok) {
                                                alert('Document reprocessing started. Please try your query again in a few moments.');
                                              } else {
                                                alert('Failed to reprocess document. Please try again later.');
                                              }
                                            } catch (error) {
                                              console.error('Error reprocessing document:', error);
                                              alert('Error reprocessing document. Please try again later.');
                                            }
                                          }}
                                          className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
                                        >
                                          Reprocess Document
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (window.confirm('Are you sure you want to delete this document? This cannot be undone.')) {
                                              try {
                                                const response = await fetch(`/api/documents/${citation.documentId}`, {
                                                  method: 'DELETE',
                                                });
                                                if (response.ok) {
                                                  alert('Document deleted successfully. You can now upload it again.');
                                                } else {
                                                  alert('Failed to delete document. Please try again later.');
                                                }
                                              } catch (error) {
                                                console.error('Error deleting document:', error);
                                                alert('Error deleting document. Please try again later.');
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
                                  <div className="p-2 bg-yellow-50 border-l-2 border-yellow-500 italic whitespace-pre-wrap">
                                    {citation.sourceText}
                                    <div className="flex justify-end mt-2">
                                      <button
                                        onClick={async () => {
                                          if (window.confirm('Are you sure you want to delete this document? This cannot be undone.')) {
                                            try {
                                              const response = await fetch(`/api/documents/${citation.documentId}`, {
                                                method: 'DELETE',
                                              });
                                              if (response.ok) {
                                                alert('Document deleted successfully. You can now upload it again.');
                                              } else {
                                                alert('Failed to delete document. Please try again later.');
                                              }
                                            } catch (error) {
                                              console.error('Error deleting document:', error);
                                              alert('Error deleting document. Please try again later.');
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
                                
                                <p className="text-right mt-1 text-gray-500">Document ID: {citation.documentId}</p>
                              </div>
                            </details>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <div className="p-4 bg-white border-t">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
} 