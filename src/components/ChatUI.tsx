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
                      {message.citations.map((citation, i) => (
                        <li key={i} className="text-xs text-gray-600">
                          <div className="bg-gray-100 p-2 rounded text-xs">
                            {citation.sourceText}
                          </div>
                        </li>
                      ))}
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