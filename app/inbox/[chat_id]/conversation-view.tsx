'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import { VersionBadge } from '@/components/version-badge';
import type { BeeperDesktop } from '@beeper/desktop-api';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { getUserSettings } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';

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
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'unresponded';
  const sortBy = searchParams.get('sortBy') || 'lastActivity';
  const platform = searchParams.get('platform') || 'all';
  const [messageText, setMessageText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [afterMessageAction, setAfterMessageAction] = useState('stay');
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isSettingReminder, setIsSettingReminder] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<any>(null);
  const [dismissOnIncomingMessage, setDismissOnIncomingMessage] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(
    `/inbox/${chatId}/messages`,
    fetcher,
    {
      onSuccess: (data) => {
        console.log('=== CONVERSATION DATA LOADED ===');
        console.log('Chat ID:', chatId);
        console.log('Messages loaded:', data?.messages?.length || 0);
        
        if (data?.messages?.length > 0) {
          console.log('=== ALL MESSAGES ===');
          data.messages.forEach((message, index) => {
            console.log(`Message ${index}:`, {
              id: message.id,
              messageID: message.messageID,
              text: message.text,
              isSender: message.isSender,
              timestamp: message.timestamp,
              senderID: message.senderID,
              chatID: message.chatID,
              accountID: message.accountID
            });
          });
          console.log('=== END ALL MESSAGES ===');
        }
        
        console.log('=== END CONVERSATION DATA ===');
      },
      onError: (error) => {
        console.error('Conversation API Error:', error);
      }
    },
  );

  // Load AI suggestion on component mount
  useEffect(() => {
    const loadSuggestion = async () => {
      if (!data?.messages?.length) return;

      console.log('chatId', chatId);
      setIsLoadingSuggestion(true);
      try {
        const response = await fetch(`/inbox/${chatId}/suggest`, { method: 'POST' });
        const result = await response.json();
        const list: string[] = result.suggestions || (result.suggestion ? [result.suggestion] : []);
        setSuggestions(list);
        if (list.length > 0) {
          setMessageText(list[0]);
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }
      } catch (error) {
        console.error('Failed to load suggestion:', error);
      } finally {
        setIsLoadingSuggestion(false);
        // scroll to bottom
        scrollToBottom();
      }
    };

    const loadAfterMessageAction = async () => {
      try {
        const response = await fetch(`/inbox/${chatId}/after-message-action`);
        if (response.ok) {
          const { afterMessageAction } = await response.json();
          setAfterMessageAction(afterMessageAction);
        }
      } catch (error) {
        console.error('Error loading after message action:', error);
      }
    };

    const loadReminderSettings = async () => {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const settings = await response.json();
          console.log('Loaded reminder settings:', settings);
          setReminderSettings(settings);
          setDismissOnIncomingMessage(settings.dismissOnIncomingMessage === 1);
        }
      } catch (error) {
        console.error('Error loading reminder settings:', error);
      }
    };

    loadSuggestion();
    loadAfterMessageAction();
    loadReminderSettings();
  }, [chatId, data?.messages]);


  // Add keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Left arrow to go back to inbox
      if (e.key === 'ArrowLeft' && document.activeElement !== inputRef.current) {
        router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
      }
      // Ctrl/Cmd + N for next conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNextConversation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, filter, sortBy, platform, chatId]);

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
        setSuggestions([]);
        
        // Handle after message action
        if (afterMessageAction === 'back_to_inbox') {
          router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
        } else if (afterMessageAction === 'next_conversation') {
          // Get next conversation
          try {
            const nextResponse = await fetch(`/inbox/${chatId}/next-conversation?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
            if (nextResponse.ok) {
              const { nextChatId, hasNext } = await nextResponse.json();
              if (hasNext && nextChatId) {
                router.push(`/inbox/${encodeURIComponent(nextChatId)}?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
              } else {
                // No next conversation, go back to inbox
                router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
              }
            } else {
              // Fallback to inbox
              router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
            }
          } catch (error) {
            console.error('Error getting next conversation:', error);
            // Fallback to inbox
            router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
          }
        }
        // If 'stay', do nothing - stay in current conversation
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleUseSuggestion = (s: string) => setMessageText(s);

  const handleNextConversation = async () => {
    if (isLoadingNext) return;
    
    setIsLoadingNext(true);
    try {
      const nextResponse = await fetch(`/inbox/${chatId}/next-conversation?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
      if (nextResponse.ok) {
        const { nextChatId, hasNext } = await nextResponse.json();
        if (hasNext && nextChatId) {
          router.push(`/inbox/${encodeURIComponent(nextChatId)}?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
        } else {
          // No next conversation, go back to inbox
          router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
        }
      } else {
        // Fallback to inbox
        router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
      }
    } catch (error) {
      console.error('Error getting next conversation:', error);
      // Fallback to inbox
      router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`);
    } finally {
      setIsLoadingNext(false);
    }
  };

  const handleSetReminder = async (minutes: number) => {
    if (isSettingReminder) return;
    
    setIsSettingReminder(true);
    try {
      const remindAtMs = Date.now() + (minutes * 60 * 1000);
      const response = await fetch(`/inbox/${chatId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remindAtMs,
          dismissOnIncomingMessage,
        }),
      });

      if (response.ok) {
        console.log(`Reminder set for ${minutes} minutes`);
      } else {
        console.error('Failed to set reminder');
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
    } finally {
      setIsSettingReminder(false);
    }
  };

  const handleSetTomorrowReminder = async (timeString: string, daysOffset: number = 1) => {
    if (isSettingReminder) return;
    
    setIsSettingReminder(true);
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysOffset);
      targetDate.setHours(hours, minutes, 0, 0);
      
      const remindAtMs = targetDate.getTime();
      const response = await fetch(`/inbox/${chatId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remindAtMs,
          dismissOnIncomingMessage,
        }),
      });

      if (response.ok) {
        const dayText = daysOffset === 1 ? 'tomorrow' : `in ${daysOffset} days`;
        console.log(`Reminder set for ${dayText} at ${timeString}`);
      } else {
        console.error('Failed to set reminder');
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
    } finally {
      setIsSettingReminder(false);
    }
  };

  const handleSetDaysReminder = async (days: number) => {
    if (isSettingReminder) return;
    
    setIsSettingReminder(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(9, 0, 0, 0); // Default to 9 AM
      
      const remindAtMs = targetDate.getTime();
      const response = await fetch(`/inbox/${chatId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          remindAtMs,
          dismissOnIncomingMessage,
        }),
      });

      if (response.ok) {
        console.log(`Reminder set for ${days} days`);
      } else {
        console.error('Failed to set reminder');
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
    } finally {
      setIsSettingReminder(false);
    }
  };

  const handleDismissOnIncomingChange = async (checked: boolean) => {
    setDismissOnIncomingMessage(checked);
    
    // Save the setting to the database
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dismissOnIncomingMessage: checked ? 1 : 0,
        }),
      });
    } catch (error) {
      console.error('Error saving dismissOnIncomingMessage setting:', error);
    }
  };

  const handleOpenInBeeper = async () => {
    try {
      console.log('Attempting to open Beeper Desktop for chat:', chatId);
      
      // First, get the chat data to find localChatID
      const chatResponse = await fetch('/inbox/api');
      const chatData = await chatResponse.json();
      
      console.log('All conversations:', chatData.conversations?.length);
      console.log('Looking for chatId:', chatId);
      
      const currentChat = chatData.conversations?.find((chat: any) => chat.id === chatId);
      
      console.log('Current chat data:', currentChat);
      console.log('Available chat IDs:', {
        id: currentChat?.id,
        localChatID: currentChat?.localChatID
      });
      
      // Try to find the chat by different methods
      const chatById = chatData.conversations?.find((chat: any) => chat.id === chatId);
      const chatByLocalId = chatData.conversations?.find((chat: any) => chat.localChatID === chatId);
      const chatByUrlEncoded = chatData.conversations?.find((chat: any) => chat.id === decodeURIComponent(chatId));
      
      console.log('Search results:', {
        chatById: !!chatById,
        chatByLocalId: !!chatByLocalId,
        chatByUrlEncoded: !!chatByUrlEncoded
      });
      
      const foundChat = chatById || chatByLocalId || chatByUrlEncoded;
      
      if (!foundChat) {
        console.error('Chat not found in conversations list!');
        console.log('Available chat IDs (first 10):', chatData.conversations?.slice(0, 10).map((c: any) => ({ id: c.id, localChatID: c.localChatID })));
        return;
      }
      
      // Use localChatID if available, otherwise fallback to id
      const chatIDToTry = foundChat?.localChatID || foundChat?.id;
      console.log('Found chat:', foundChat);
      console.log('Chat ID options:', {
        id: foundChat?.id,
        localChatID: foundChat?.localChatID,
        using: chatIDToTry
      });
      
      const response = await fetch('/api/beeper/open-app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatID: chatIDToTry,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('Successfully opened Beeper Desktop:', result);
      } else {
        const errorText = await response.text();
        console.error('Failed to open Beeper Desktop. Status:', response.status, 'Error:', errorText);
      }
    } catch (error) {
      console.error('Error opening Beeper Desktop:', error);
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
  
  // Determine if this is a follow-up situation (user sent last message)
  const isFollowUp = messages.length > 0 && messages[messages.length - 1]?.isSender;
  const suggestionType = isFollowUp ? "AI Follow Up Suggestions:" : "AI Suggestions:";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-border/40 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${platform}`)}
            className="text-muted-foreground hover:text-foreground"
            type="button"
          >
            ← Back to Inbox
          </button>
          <h1 className="text-lg font-semibold">
            Conversation ({messages.length} messages)
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs" title="✅ Checked: Reminders are automatically cancelled when someone replies to this conversation. ❌ Unchecked: Reminders stay active even after receiving new messages.">
              <input
                type="checkbox"
                checked={dismissOnIncomingMessage}
                onChange={(e) => handleDismissOnIncomingChange(e.target.checked)}
                className="rounded border border-zinc-300 bg-background dark:border-zinc-700"
              />
              <span className="text-muted-foreground">Auto-dismiss</span>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Remind me later in:</span>
            <button
              onClick={() => handleSetReminder(5)}
              disabled={isSettingReminder}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
              type="button"
              title="Remind in 5 minutes"
            >
              5m
            </button>
            <button
              onClick={() => handleSetReminder(30)}
              disabled={isSettingReminder}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
              type="button"
              title="Remind in 30 minutes"
            >
              30m
            </button>
            <button
              onClick={() => handleSetReminder(60)}
              disabled={isSettingReminder}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
              type="button"
              title="Remind in 1 hour"
            >
              1h
            </button>
            <button
              onClick={() => handleSetReminder(180)}
              disabled={isSettingReminder}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
              type="button"
              title="Remind in 3 hours"
            >
              3h
            </button>
            {/* Morning Dropdown */}
            <div className="relative group">
              <button
                onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMorning || '09:00')}
                disabled={isSettingReminder}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                type="button"
                title={`Remind tomorrow morning at ${reminderSettings?.remindTomorrowMorning || '09:00'}`}
              >
                Morning
              </button>
              <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMorning || '09:00', 1)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Tomorrow Morning
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMorning || '09:00', 2)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 2 days Morning
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMorning || '09:00', 3)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 3 days Morning
                  </button>
                </div>
              </div>
            </div>

            {/* Midday Dropdown */}
            <div className="relative group">
              <button
                onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMidday || '12:00')}
                disabled={isSettingReminder}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                type="button"
                title={`Remind tomorrow midday at ${reminderSettings?.remindTomorrowMidday || '12:00'}`}
              >
                Midday
              </button>
              <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMidday || '12:00', 1)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Tomorrow Midday
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMidday || '12:00', 2)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 2 days Midday
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowMidday || '12:00', 3)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 3 days Midday
                  </button>
                </div>
              </div>
            </div>

            {/* Evening Dropdown */}
            <div className="relative group">
              <button
                onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowEvening || '18:00')}
                disabled={isSettingReminder}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                type="button"
                title={`Remind tomorrow evening at ${reminderSettings?.remindTomorrowEvening || '18:00'}`}
              >
                Evening
              </button>
              <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowEvening || '18:00', 1)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Tomorrow Evening
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowEvening || '18:00', 2)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 2 days Evening
                  </button>
                  <button
                    onClick={() => handleSetTomorrowReminder(reminderSettings?.remindTomorrowEvening || '18:00', 3)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    In 3 days Evening
                  </button>
                </div>
              </div>
            </div>

            {/* 3 Days Dropdown */}
            <div className="relative group">
              <button
                onClick={() => handleSetReminder(4320)}
                disabled={isSettingReminder}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                type="button"
                title="Remind in 3 days"
              >
                3d
              </button>
              <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => handleSetDaysReminder(1)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    1 day
                  </button>
                  <button
                    onClick={() => handleSetDaysReminder(2)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    2 days
                  </button>
                  <button
                    onClick={() => handleSetDaysReminder(3)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    3 days
                  </button>
                </div>
              </div>
            </div>

            {/* 7 Days Dropdown */}
            <div className="relative group">
              <button
                onClick={() => handleSetReminder(10080)}
                disabled={isSettingReminder}
                className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                type="button"
                title="Remind in 7 days"
              >
                7d
              </button>
              <div className="absolute top-full left-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                  <button
                    onClick={() => handleSetDaysReminder(7)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    7 days
                  </button>
                  <button
                    onClick={() => handleSetDaysReminder(10)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    10 days
                  </button>
                  <button
                    onClick={() => handleSetDaysReminder(14)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    14 days
                  </button>
                  <button
                    onClick={() => handleSetDaysReminder(30)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    30 days
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleNextConversation}
            disabled={isLoadingNext}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-md transition-colors disabled:opacity-50"
            type="button"
            title="Skip to next conversation (Ctrl/Cmd + N)"
          >
            {isLoadingNext ? (
              <div className="animate-spin w-4 h-4">
                <LoaderIcon />
              </div>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            Next Chat
          </button>
          <button
            onClick={handleOpenInBeeper}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            type="button"
            title="Open this conversation in Beeper Desktop"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10,17 15,12 10,7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </button>
          <VersionBadge />
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

      {/* AI Suggestions */}
      {(suggestions.length > 0 || isLoadingSuggestion) && (
        <div className="border-t border-border/40 p-4 bg-muted/30">
          <div className="text-sm font-medium mb-2">{suggestionType}</div>
          {isLoadingSuggestion ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin">
                <LoaderIcon size={12} />
              </div>
              Generating suggestion...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {suggestions.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div 
                    onClick={() => handleUseSuggestion(s)}
                    className="flex-1 text-sm p-2 bg-background rounded border cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {s}
                  </div>
                  <button
                    onClick={() => handleUseSuggestion(s)}
                    type="button"
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    Use
                  </button>
                </div>
              ))}
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
