'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import { VersionBadge } from '@/components/version-badge';
import type { BeeperDesktop } from '@beeper/desktop-api';

type Chat = BeeperDesktop.Chats.Chat;
type Message = BeeperDesktop.Message;

interface ChatWithLastMessage extends Chat {
  lastMessage: Message | null;
  isUnresponded: boolean;
  isUnread: boolean;
  followUpCount: number;
  lastOtherMessageTime: string | null;
  platform: string;
}

interface ConversationsResponse {
  conversations: ChatWithLastMessage[];
  hasMore: boolean;
}

function ConversationRow({
  conversation,
  isSelected,
  onClick,
  isArchiving = false,
  currentFilter,
}: {
  conversation: ChatWithLastMessage;
  isSelected: boolean;
  onClick: () => void;
  isArchiving?: boolean;
  currentFilter: 'unresponded' | 'noAnswer' | 'all';
}) {
  const {
    isUnresponded,
    isUnread,
    lastMessage,
    lastActivity,
    title,
    unreadCount,
    followUpCount,
    lastOtherMessageTime,
    platform,
  } = conversation;

  const displayName = title || 'Unknown Chat';

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      // 1 week
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks}w ago`;
    } else {
      const months = Math.floor(diffInDays / 30);
      return `${months}mo ago`;
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      telegram: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      signal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      facebook: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      messenger: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      twitter: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
      linkedin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      slack: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      discord: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      sms: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      imessage: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      googlechat: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rcs: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      matrix: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };
    return colors[platform.toLowerCase()] || colors.unknown;
  };

  // Get the first participant that's not the user for avatar
  const otherParticipant = conversation.participants.items.find(
    (p) => !p.isSelf,
  );

  // Use lastMessage timestamp if available, otherwise fallback to lastActivity
  const displayTimestamp = lastMessage?.timestamp || lastActivity;
  const lastMessageText = lastMessage?.text || 'No messages';
  const lastMessageSender = lastMessage?.senderName;

  const status = isUnread ? 'Unread' : isUnresponded ? 'Unresponded' : null;

  return (
    <div
      className={`w-full border-b border-border/40 hover:bg-muted/50 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-muted border-l-4 border-l-primary'
          : 'border-l-4 border-l-muted'
      } ${isArchiving ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 p-4">
        {isArchiving && (
          <div className="flex items-center justify-center w-4 h-4">
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
          </div>
        )}
        <div className="flex-shrink-0">
          {otherParticipant?.imgURL ? (
            <img
              src={otherParticipant.imgURL}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg font-medium text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {displayName}
              </h3>
              {status && (
                <span className="text-xs text-muted-foreground">{status}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPlatformColor(platform)}`}>
                {platform}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {displayTimestamp && (
                <span>{formatTimestamp(displayTimestamp)}</span>
              )}
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          {/* Sales info only for "No Answer" filter */}
          {currentFilter === 'noAnswer' && lastMessage?.isSender && lastOtherMessageTime && (
            <div className="flex items-center gap-3 mb-1 text-xs text-muted-foreground">
              <span className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded">
                {formatRelativeTime(lastOtherMessageTime)} last response
              </span>
              {followUpCount > 0 && (
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded">
                  {followUpCount} follow-up{followUpCount !== 1 ? 's' : ''} sent
                </span>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground truncate">
            {lastMessageSender && !lastMessage?.isSender && (
              <span className="font-medium">{lastMessageSender}: </span>
            )}
            {lastMessage?.isSender && (
              <span className="font-medium">You: </span>
            )}
            {lastMessageText}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get filter from URL or default to 'unresponded'
  const rawFilter = searchParams.get('filter');
  const normalizedFilter = (rawFilter === 'unresponded' || rawFilter === 'noAnswer' || rawFilter === 'all')
    ? rawFilter
    : 'unresponded';
  const [filter, setFilter] = useState<'unresponded' | 'noAnswer' | 'all'>(normalizedFilter as 'unresponded' | 'noAnswer' | 'all');
  
  // Get sort from URL or default to 'lastActivity'
  const sortBy = searchParams.get('sortBy') || 'lastActivity';
  
  // Get platform filter from URL
  const platformFilter = searchParams.get('platform') || 'all';
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [archivingConversation, setArchivingConversation] = useState<
    string | null
  >(null);

  const { data, error, isLoading, mutate } = useSWR<ConversationsResponse>(
    `/inbox/api?sortBy=${sortBy}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      onSuccess: (data) => {
        console.log('=== INBOX DATA LOADED ===');
        console.log('Conversations:', data?.conversations?.length || 0);
        if (data?.conversations?.length > 0) {
          console.log('First conversation:', data.conversations[0]);
          console.log('Platforms found:', [...new Set(data.conversations.map(c => c.platform))]);
          
          // Log all conversations with their details
          console.log('=== ALL CONVERSATIONS ===');
          data.conversations.forEach((conv, index) => {
            console.log(`Conversation ${index}:`, {
              id: conv.id,
              title: conv.title,
              platform: conv.platform,
              accountID: conv.accountID,
              network: conv.network,
              lastMessage: conv.lastMessage ? {
                id: conv.lastMessage.id,
                text: conv.lastMessage.text,
                isSender: conv.lastMessage.isSender,
                timestamp: conv.lastMessage.timestamp
              } : null,
              isUnread: conv.isUnread,
              isUnresponded: conv.isUnresponded,
              unreadCount: conv.unreadCount,
              followUpCount: conv.followUpCount,
              lastOtherMessageTime: conv.lastOtherMessageTime
            });
            
            // Special debug for Jenny's conversation
            if (conv.id === '!A2sc3epuuEVEd4quBWWn:beeper.local') {
              console.log('🔍 JENNY CONVERSATION DEBUG:', {
                followUpCount: conv.followUpCount,
                lastMessage: conv.lastMessage,
                isUnresponded: conv.isUnresponded,
                lastOtherMessageTime: conv.lastOtherMessageTime
              });
            }
          });
          console.log('=== END ALL CONVERSATIONS ===');
        }
        console.log('=== END INBOX DATA ===');
      },
      onError: (error) => {
        console.error('Inbox API Error:', error);
      }
    },
  );

  // Debug: Log when component mounts and data changes
  useEffect(() => {
    console.log('=== INBOX COMPONENT MOUNTED ===');
    console.log('isLoading:', isLoading);
    console.log('error:', error);
    console.log('data:', data);
  }, [isLoading, error, data]);

  // Get unique platforms for filter dropdown
  const availablePlatforms = data?.conversations 
    ? [...new Set(data.conversations.map(conv => conv.platform))].sort()
    : [];

  // Filter conversations based on the current filter and platform
  const filteredConversations =
    data?.conversations.filter((conv) => {
      // Apply conversation filter
      if (filter === 'unresponded') {
        if (!(conv.isUnresponded || conv.isUnread)) return false;
      } else if (filter === 'noAnswer') {
        if (!(conv.lastMessage?.isSender && !conv.isUnread)) return false;
      }
      
      // Apply platform filter
      if (platformFilter !== 'all' && conv.platform !== platformFilter) {
        return false;
      }
      
      return true;
    }) || [];

  // Reset selected index when conversations change
  useEffect(() => {
    if (
      filteredConversations.length > 0 &&
      selectedIndex >= filteredConversations.length
    ) {
      setSelectedIndex(0);
    }
  }, [filteredConversations.length, selectedIndex]);

  const handleArchiveConversation = async (conversationId: string) => {
    setArchivingConversation(conversationId);
    try {
      const response = await fetch('/inbox/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: conversationId,
          archived: true,
        }),
      });

      if (response.ok) {
        // Refresh the conversation list
        await mutate();
        // Adjust selected index if needed
        if (
          selectedIndex >= filteredConversations.length - 1 &&
          selectedIndex > 0
        ) {
          setSelectedIndex(selectedIndex - 1);
        }
      } else {
        console.error('Failed to archive conversation');
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    } finally {
      setArchivingConversation(null);
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filteredConversations.length === 0) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredConversations.length - 1,
          );
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredConversations.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowRight':
        case 'l':
        case 'Enter':
          e.preventDefault();
          if (filteredConversations[selectedIndex]) {
            router.push(
              `/inbox/${encodeURIComponent(filteredConversations[selectedIndex].id)}?filter=${filter}&sortBy=${sortBy}&platform=${platformFilter}`,
            );
          }
          break;
        case 'e':
        case 'a':
          e.preventDefault();
          if (filteredConversations[selectedIndex] && !archivingConversation) {
            handleArchiveConversation(filteredConversations[selectedIndex].id);
          }
          break;
      }
    },
    [
      filteredConversations,
      selectedIndex,
      router,
      archivingConversation,
      handleArchiveConversation,
    ],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleConversationClick = (index: number) => {
    setSelectedIndex(index);
    router.push(
      `/inbox/${encodeURIComponent(filteredConversations[index].id)}?filter=${filter}&sortBy=${sortBy}&platform=${platformFilter}`,
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <span className="ml-2">Loading conversations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load conversations</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Text ZERO</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredConversations.length} conversation
              {filteredConversations.length !== 1 ? 's' : ''}
              {filter === 'unresponded' && data?.conversations && (
                <span> ({data.conversations.length} total)</span>
              )}
              {filter === 'noAnswer' && data?.conversations && (
                <span> ({data.conversations.length} total)</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <VersionBadge />
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setFilter('unresponded');
                  router.push(`/inbox?filter=unresponded&sortBy=${sortBy}&platform=${platformFilter}`);
                }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  filter === 'unresponded'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unresponded
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter('noAnswer');
                  router.push(`/inbox?filter=noAnswer&sortBy=${sortBy}&platform=${platformFilter}`);
                }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  filter === 'noAnswer'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                No Answer
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  router.push(`/inbox?filter=all&sortBy=${sortBy}&platform=${platformFilter}`);
                }}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
            </div>
            
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => {
                const newSortBy = e.target.value;
                router.push(`/inbox?filter=${filter}&sortBy=${newSortBy}&platform=${platformFilter}`);
              }}
              className="px-3 py-1 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="lastActivity">Last Activity</option>
              <option value="name">Name A-Z</option>
              <option value="unreadCount">Unread Count</option>
              <option value="lastResponse">Last Response</option>
              <option value="followUpCount">Follow-ups</option>
              <option value="lastMessage">Last Message</option>
            </select>
            
            {/* Platform Filter Dropdown */}
            <select
              value={platformFilter}
              onChange={(e) => {
                const newPlatform = e.target.value;
                router.push(`/inbox?filter=${filter}&sortBy=${sortBy}&platform=${newPlatform}`);
              }}
              className="px-3 py-1 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Platforms</option>
              {availablePlatforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => router.push('/profile')}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Profile Settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground hover:text-foreground"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-muted-foreground">
                {filter === 'unresponded'
                  ? 'No unresponded conversations'
                  : filter === 'noAnswer'
                  ? 'No conversations with no answer'
                  : 'No conversations found'}
              </p>
              {filter === 'unresponded' && data?.conversations?.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  Switch to "All" to see {data.conversations.length} total
                  conversations
                </p>
              )}
              {filter === 'noAnswer' && data?.conversations?.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  Switch to "All" to see {data.conversations.length} total
                  conversations
                </p>
              )}
            </div>
          </div>
        ) : (
          filteredConversations.map((conversation, index) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              isSelected={index === selectedIndex}
              onClick={() => handleConversationClick(index)}
              isArchiving={archivingConversation === conversation.id}
              currentFilter={filter}
            />
          ))
        )}
      </div>

      {filteredConversations.length > 0 && (
        <div className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
          Use ↑↓ or j/k to navigate, → or Enter to open, e/a to archive
        </div>
      )}
    </div>
  );
}
