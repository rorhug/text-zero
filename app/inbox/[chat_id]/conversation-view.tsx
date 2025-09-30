'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import { VersionBadge } from '@/components/version-badge';
import type { BeeperDesktop } from '@beeper/desktop-api';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';

type Message = BeeperDesktop.Message;

interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  chatId: string;
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isFromUser = message.isSender;
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex mb-4 ${isFromUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isFromUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {!isFromUser && message.senderName && (
          <div className="text-xs font-medium mb-1 opacity-70">
            {message.senderName}
          </div>
        )}
        <div className="text-sm">{message.text || '[no text content]'}</div>
        <div className={`text-xs mt-1 opacity-70`}>{timestamp}</div>
      </div>
    </div>
  );
}

export function ConversationView({ chatId }: { chatId: string }) {
  const { containerRef: messagesContainerRef, scrollToBottom } =
    useScrollToBottom();
  const router = useRouter();
  const [messageText, setMessageText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    `/inbox/${chatId}/messages`,
    fetcher,
  );

  // Load AI suggestion on component mount
  useEffect(() => {
    const loadSuggestion = async () => {
      if (!data?.messages?.length) return;

      console.log('chatId', chatId);
      setIsLoadingSuggestion(true);
      try {
        const response = await fetch(`/inbox/${chatId}/suggest`, {
          method: 'POST',
        });
        const result = await response.json();
        const suggestionText = result.suggestion || '';
        setSuggestion(suggestionText);
        // Set AI suggestion to input and select all text
        setMessageText(suggestionText);
        // Focus input and select all text
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      } finally {
        setIsLoadingSuggestion(false);
        // scroll to bottom
        scrollToBottom();
      }
    };

    loadSuggestion();
  }, [chatId, data?.messages]);

  // Add keyboard handler for left arrow key to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && document.activeElement !== inputRef.current) {
        router.push('/inbox');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`/inbox/${chatId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: messageText,
        }),
      });

      if (response.ok) {
        setMessageText('');
        setSuggestion('');
        // Refresh messages
        // await mutate();
        // Navigate back to inbox
        router.push('/inbox');
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleUseSuggestion = () => {
    setMessageText(suggestion);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <span className="ml-2">Loading conversation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load conversation</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  const messages = data?.messages || [];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-border/40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/inbox')}
            className="text-muted-foreground hover:text-foreground"
            type="button"
          >
            ← Back to Inbox
          </button>
          <h1 className="text-lg font-semibold">
            Conversation ({messages.length} messages)
          </h1>
        </div>
        <VersionBadge />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages in this conversation
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      {/* AI Suggestion */}
      {(suggestion || isLoadingSuggestion) && (
        <div className="border-t border-border/40 p-4 bg-muted/30">
          <div className="text-sm font-medium mb-2">AI Suggestion:</div>
          {isLoadingSuggestion ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin">
                <LoaderIcon size={12} />
              </div>
              Generating suggestion...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm p-2 bg-background rounded border">
                {suggestion}
              </div>
              <button
                onClick={handleUseSuggestion}
                type="button"
                className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Use
              </button>
            </div>
          )}
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-border/40 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] max-h-32 p-2 border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || isSending}
            type="button"
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
