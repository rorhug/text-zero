'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SuggestionsLimitSlider } from './suggestions-limit-slider';

interface ProfileFormProps {
  settings: any;
}

export function ProfileForm({ settings }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

  const defaultPrompt = 'You are a smart messaging assistant that helps with optimal communication timing and content. Consider the conversation context, timing of messages, and suggest the best responses. Pay attention to:\n\n1. Message timing - when is the optimal time to respond (immediate, wait a bit, or delay)\n2. Content quality - natural, engaging responses that match the conversation tone\n3. Context awareness - understand the conversation flow and respond appropriately\n\nAlways suggest full sentences, not just words. Consider if a quick response, delayed response, or follow-up later would be most effective. Max 5 suggestions.';
  const defaultFollowUpPrompt = 'You are a helpful assistant. The user has just sent a message and is waiting for a response. Suggest appropriate follow-up messages that could continue the conversation naturally. Consider the context and tone of the conversation.';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionPrompt: formData.get('suggestionPrompt') as string || null,
          followUpPrompt: formData.get('followUpPrompt') as string || null,
          summaryPrompt: formData.get('summaryPrompt') as string || null,
          messageLimit: parseInt(formData.get('messageLimit') as string) || 30,
          suggestionsLimit: Math.min(5, Math.max(1, parseInt(formData.get('suggestionsLimit') as string) || 3)),
          conversationsLimit: Math.min(200, Math.max(5, parseInt(formData.get('conversationsLimit') as string) || 10)),
          followUpTimeLimit: parseInt(formData.get('followUpTimeLimit') as string) || 5,
          followUpTimeUnit: formData.get('followUpTimeUnit') as string || 'minutes',
          afterMessageAction: formData.get('afterMessageAction') as string || 'stay',
          archiveAction: formData.get('archiveAction') as string || 'next_conversation',
          remindTomorrowMorning: formData.get('remindTomorrowMorning') as string || '09:00',
          remindTomorrowMidday: formData.get('remindTomorrowMidday') as string || '12:00',
          remindTomorrowEvening: formData.get('remindTomorrowEvening') as string || '18:00',
          dismissOnIncomingMessage: formData.get('dismissOnIncomingMessage') === 'on' ? 1 : 0,
          enableSummary: formData.get('enableSummary') === 'on' ? 1 : 0,
        }),
      });

      if (response.ok) {
        showToast('✅ Saved', 'success');
      } else {
        showToast('❌ Failed to save settings', 'error');
      }
    } catch (error) {
      showToast('❌ Error saving settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-sm font-medium ${
          toast.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}
      
      <form action={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Custom Suggestion Prompt</label>
          <textarea
            name="suggestionPrompt"
            defaultValue={settings?.suggestionPrompt ?? defaultPrompt}
            placeholder="You are a help writing assistant..."
            className="w-full min-h-40 rounded-md border border-zinc-300 bg-background p-3 text-sm dark:border-zinc-700"
          />
          <p className="text-xs text-muted-foreground">
            Used for all message suggestions. Considers optimal timing and content quality.
          </p>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium">Follow Up Prompt</label>
          <textarea
            name="followUpPrompt"
            defaultValue={settings?.followUpPrompt ?? defaultFollowUpPrompt}
            placeholder="You are a helpful assistant..."
            className="w-full min-h-40 rounded-md border border-zinc-300 bg-background p-3 text-sm dark:border-zinc-700"
          />
          <p className="text-xs text-muted-foreground">
            Used when you sent the last message (waiting for response)
          </p>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium">Summary Prompt</label>
          <textarea
            name="summaryPrompt"
            defaultValue={settings?.summaryPrompt ?? 'Provide a brief 1-2 sentence summary of the conversation context and current situation. Focus on the key points and what needs to be addressed next.'}
            placeholder="Provide a brief summary..."
            className="w-full min-h-32 rounded-md border border-zinc-300 bg-background p-3 text-sm dark:border-zinc-700"
          />
          <p className="text-xs text-muted-foreground">
            Used to generate conversation summaries above suggestions
          </p>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium">Message Limit</label>
          <input
            type="number"
            name="messageLimit"
            defaultValue={settings?.messageLimit ?? 30}
            min="10"
            max="100"
            className="w-32 rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
          />
          <p className="text-xs text-muted-foreground">
            Number of messages to load for suggestions (10-100)
          </p>
        </div>
        
        <SuggestionsLimitSlider defaultValue={settings?.suggestionsLimit ?? 3} />

        <div className="space-y-3">
          <label className="block text-sm font-medium">Conversations Limit</label>
          <input
            type="number"
            name="conversationsLimit"
            defaultValue={settings?.conversationsLimit ?? 10}
            min="5"
            max="200"
            className="w-32 rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
          />
          <p className="text-xs text-muted-foreground">
            Number of conversations to load initially (5-200)
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Follow-up Time Limit</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="followUpTimeLimit"
              defaultValue={settings?.followUpTimeLimit ?? 5}
              min="1"
              max="100"
              className="w-20 rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
            />
            <select
              name="followUpTimeUnit"
              defaultValue={settings?.followUpTimeUnit ?? 'minutes'}
              className="rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimum time between follow-up messages to count as separate follow-ups
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">After Message Action</label>
          <select
            name="afterMessageAction"
            defaultValue={settings?.afterMessageAction ?? 'stay'}
            className="w-48 rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
          >
            <option value="stay">Stay in conversation</option>
            <option value="back_to_inbox">Go back to inbox</option>
            <option value="next_conversation">Go to next conversation</option>
          </select>
          <p className="text-xs text-muted-foreground">
            What happens after you send a message
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">After Archive Action</label>
          <select
            name="archiveAction"
            defaultValue={settings?.archiveAction ?? 'next_conversation'}
            className="w-48 rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
          >
            <option value="stay">Stay in conversation</option>
            <option value="back_to_inbox">Go back to inbox</option>
            <option value="next_conversation">Go to next conversation</option>
          </select>
          <p className="text-xs text-muted-foreground">
            What happens after you archive a conversation
          </p>
        </div>
        
        <div className="space-y-6">
          <h3 className="text-lg font-medium">Reminder Settings</h3>
          
          <div className="space-y-4">
            <h4 className="text-md font-medium">Tomorrow Times</h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <label className="block text-sm font-medium">Morning</label>
                <input
                  type="time"
                  name="remindTomorrowMorning"
                  defaultValue={settings?.remindTomorrowMorning ?? '09:00'}
                  className="w-full rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium">Midday</label>
                <input
                  type="time"
                  name="remindTomorrowMidday"
                  defaultValue={settings?.remindTomorrowMidday ?? '12:00'}
                  className="w-full rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium">Evening</label>
                <input
                  type="time"
                  name="remindTomorrowEvening"
                  defaultValue={settings?.remindTomorrowEvening ?? '18:00'}
                  className="w-full rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="dismissOnIncomingMessage"
                defaultChecked={settings?.dismissOnIncomingMessage !== 0}
                className="rounded border border-zinc-300 bg-background dark:border-zinc-700"
              />
              <span className="text-sm font-medium">Dismiss reminder when someone replies</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When enabled, reminders are automatically cancelled if someone replies to the conversation
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="enableSummary"
                defaultChecked={settings?.enableSummary === 1}
                className="rounded border border-zinc-300 bg-background dark:border-zinc-700"
              />
              <span className="text-sm font-medium">Enable conversation summary</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When enabled, a summary of the conversation will be displayed above AI suggestions
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/inbox')}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80"
          >
            Back to Inbox
          </button>
        </div>
      </form>
    </>
  );
}
