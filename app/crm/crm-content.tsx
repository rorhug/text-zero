'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { LoaderIcon } from '@/components/icons';
import { VersionBadge } from '@/components/version-badge';
import type { BeeperChat } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';

interface ContactsResponse {
  contacts: BeeperChat[];
}

export function CRMContent() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR<ContactsResponse>(
    '/crm/api',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">
          <LoaderIcon />
        </div>
        <span className="ml-2">Loading contacts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load contacts</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  const contacts = data?.contacts || [];

  const formatDate = (timestamp: Date) => {
    return new Date(timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-border/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <VersionBadge />
            <button
              type="button"
              onClick={() => router.push('/inbox')}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Back to Inbox
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">
              No contacts yet. Start chatting to build your CRM!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-4 font-medium">Name</th>
                  <th className="text-left p-4 font-medium">Summary</th>
                  <th className="text-left p-4 font-medium">Interests</th>
                  <th className="text-left p-4 font-medium">Notes</th>
                  <th className="text-left p-4 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.chatId}
                    className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/inbox/${encodeURIComponent(contact.chatId)}`)}
                  >
                    <td className="p-4 font-medium">{contact.name}</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-md">
                      {contact.summary || '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.interests && contact.interests.length > 0 ? (
                          contact.interests.map((interest) => (
                            <span
                              key={interest}
                              className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded"
                            >
                              {interest}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground max-w-md">
                      {contact.notes || '-'}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(contact.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
