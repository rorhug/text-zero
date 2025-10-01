'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import type { BeeperDesktop } from '@beeper/desktop-api';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import Shortcut from '@/components/shortcut';

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
        <div className="text-sm break-words whitespace-pre-wrap">
          {message.text || '[no text content]'}
        </div>

        <div className={`text-xs mt-1 opacity-70`}>{timestamp}</div>
      </div>
    </div>
  );
}

export function ConversationView({
  chatId,
  onBack,
}: {
  chatId: string;
  onBack?: () => void;
}) {
  const { containerRef: messagesContainerRef, scrollToBottom } =
    useScrollToBottom();
  const router = useRouter();
  const [messageText, setMessageText] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSuggestionExpanded, setIsSuggestionExpanded] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestionRef = useRef<string>('');
  const messageTextRef = useRef<string>('');
  const hasLoadedSuggestionRef = useRef<string>(''); // Track chatId to prevent duplicate fetches

  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    `/inbox/${chatId}/messages`,
    fetcher,
    {
      on,
    },
  );

  // Scroll to bottom immediately when messages load
  useEffect(() => {
    if (data?.messages?.length) {
      scrollToBottom('instant');
    }
  }, [data?.messages?.length, scrollToBottom]);

  // Load AI suggestion on component mount
  useEffect(() => {
    const loadSuggestion = async () => {
      if (!data?.messages?.length) return;

      // Prevent duplicate fetches for the same chat
      if (hasLoadedSuggestionRef.current === chatId) return;
      hasLoadedSuggestionRef.current = chatId;

      console.log('chatId', chatId);
      setIsLoadingSuggestion(true);
      try {
        const response = await fetch(`/inbox/${chatId}/suggest`, {
          method: 'POST',
        });
        const result = await response.json();
        const suggestionText = result.suggestion || '';
        setSuggestion(suggestionText);
        suggestionRef.current = suggestionText;
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      } finally {
        setIsLoadingSuggestion(false);
      }
    };

    loadSuggestion();
  }, [chatId, data?.messages]);

  // Keep refs in sync
  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);

  useEffect(() => {
    messageTextRef.current = messageText;
  }, [messageText]);

  // Add keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isAnyInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Escape to unfocus input
      if (e.key === 'Escape' && isAnyInputFocused) {
        (target as HTMLInputElement | HTMLTextAreaElement).blur();
        return;
      }

      // Don't handle shortcuts when any input/textarea is focused
      if (isAnyInputFocused) return;

      // Don't handle single-key shortcuts when Cmd is pressed (preserve browser shortcuts)
      if (e.metaKey || e.ctrlKey) return;

      // Handle keyboard shortcuts when no input is focused
      if (true) {
        // Focus input with f and select all text
        if (e.key === 'f') {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
          return;
        }

        // Use AI suggestion with g
        if (e.key === 'g') {
          e.preventDefault();
          if (suggestionRef.current) {
            setMessageText(suggestionRef.current);
            inputRef.current?.focus();
            // Auto-resize textarea after setting text
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.style.height = 'auto';
                inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
              }
            }, 0);
          }
          return;
        }

        // Go back to inbox with left arrow or h (don't interfere with alt+arrow for word navigation)
        if (e.key === 'ArrowLeft' && !e.altKey) {
          if (onBack) {
            onBack();
            window.history.replaceState(null, '', '/inbox');
          } else {
            router.push('/inbox');
          }
        }
        if (e.key === 'h') {
          if (onBack) {
            onBack();
            window.history.replaceState(null, '', '/inbox');
          } else {
            router.push('/inbox');
          }
        }

        // Archive with e
        if (e.key === 'e') {
          handleArchiveConversation();
        }
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
        if (onBack) {
          onBack();
          window.history.replaceState(null, '', '/inbox');
        } else {
          router.push('/inbox');
        }
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

  const handleArchiveConversation = async () => {
    if (isArchiving) return;

    setIsArchiving(true);
    try {
      const response = await fetch('/inbox/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          archived: true,
        }),
      });

      if (response.ok) {
        // Navigate back to inbox after archiving
        if (onBack) {
          onBack();
          window.history.replaceState(null, '', '/inbox');
        } else {
          router.push('/inbox');
        }
      } else {
        console.error('Failed to archive conversation');
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    } finally {
      setIsArchiving(false);
    }
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
          {!onBack && (
            <button
              onClick={() => router.push('/inbox')}
              className="text-muted-foreground hover:text-foreground"
              type="button"
            >
              ← Back to Inbox
            </button>
          )}
          <h1 className="text-lg font-semibold">
            Conversation ({messages.length} messages)
          </h1>
        </div>
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
      <div className="border-t border-border/40 px-4 py-2 bg-muted/30 min-h-20">
        {/* <div className="text-sm font-medium mb-2">AI Suggestion:</div> */}
        {isLoadingSuggestion ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
            Generating suggestion...
          </div>
        ) : suggestion ? (
          <div className="flex items-stretch gap-2">
            <div
              className={`flex-1 text-sm p-2 bg-background rounded border cursor-pointer ${
                isSuggestionExpanded ? '' : 'line-clamp-2'
              }`}
              onClick={() => setIsSuggestionExpanded(!isSuggestionExpanded)}
            >
              {suggestion}
            </div>
            <button
              onClick={handleUseSuggestion}
              type="button"
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <Shortcut keys="g" text="use" />
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground h-10">
            No suggestion available
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-border/40 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              // Auto-resize textarea
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] max-h-[240px] p-2 border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary overflow-y-auto"
            onFocus={() => {
              setIsInputFocused(true);
              scrollToBottom('instant');
            }}
            onBlur={() => setIsInputFocused(false)}
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
            {isSending ? 'Sending...' : <Shortcut keys="⏎" text="send" />}
          </button>
        </div>
        <div className="text-xs text-muted-foreground mt-1 gap-1 flex">
          <Shortcut keys="f" text="focus" />
          <Shortcut keys="g" text="use suggestion" />
          <Shortcut keys="esc" text="unfocus" />
          <Shortcut keys="⏎" text="send" />
          <Shortcut keys="⇧+⏎" text="new line" />
          {/* f to focus, g to use suggestion, Enter to send, Shift+Enter for new line, e/a to
          archive, ←/h to go back */}
        </div>
      </div>
    </div>
  );
}
