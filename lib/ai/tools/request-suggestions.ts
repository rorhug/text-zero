import { z } from 'zod';
import type { Session } from 'next-auth';
import { streamObject, tool, type UIMessageStreamWriter } from 'ai';
import { getDocumentById, saveSuggestions } from '@/lib/db/queries';
import type { Suggestion } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils';
import { myProvider } from '../providers';
import { getUserSettings } from '@/lib/db/queries';
import type { ChatMessage } from '@/lib/types';

interface RequestSuggestionsProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const requestSuggestions = ({
  session,
  dataStream,
}: RequestSuggestionsProps) =>
  tool({
    description: 'Request suggestions for a document',
    inputSchema: z.object({
      documentId: z
        .string()
        .describe('The ID of the document to request edits'),
    }),
    execute: async ({ documentId }) => {
      const document = await getDocumentById({ id: documentId });

      if (!document || !document.content) {
        return {
          error: 'Document not found',
        };
      }

      const suggestions: Array<
        Omit<Suggestion, 'userId' | 'createdAt' | 'documentCreatedAt'>
      > = [];

      let systemPrompt =
        'You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words.';

      // Determine desired suggestions count (1-5)
      let suggestionsLimit = 3;
      if (session.user?.id) {
        try {
          const settings = await getUserSettings({ userId: session.user.id });
          if (settings?.suggestionPrompt) {
            systemPrompt = settings.suggestionPrompt;
          }
          if (settings?.suggestionsLimit) {
            suggestionsLimit = Math.min(5, Math.max(1, settings.suggestionsLimit));
          }
        } catch {}
      }

      if (session.user?.id) {
        try {
          const settings = await getUserSettings({ userId: session.user.id });
          if (settings?.suggestionPrompt) {
            systemPrompt = settings.suggestionPrompt;
          }
        } catch {}
      }

      const { elementStream } = streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: systemPrompt,
        prompt: document.content,
        output: 'array',
        schema: z.object({
          originalSentence: z.string().describe('The original sentence'),
          suggestedSentence: z.string().describe('The suggested sentence'),
          description: z.string().describe('The description of the suggestion'),
        }),
      });

      let count = 0;
      for await (const element of elementStream) {
        if (count >= suggestionsLimit) break;
        // @ts-ignore todo: fix type
        const suggestion: Suggestion = {
          originalText: element.originalSentence,
          suggestedText: element.suggestedSentence,
          description: element.description,
          id: generateUUID(),
          documentId: documentId,
          isResolved: false,
        };

        dataStream.write({
          type: 'data-suggestion',
          data: suggestion,
          transient: true,
        });

        suggestions.push(suggestion);
        count++;
      }

      if (session.user?.id) {
        const userId = session.user.id;

        await saveSuggestions({
          suggestions: suggestions.map((suggestion) => ({
            ...suggestion,
            userId,
            createdAt: new Date(),
            documentCreatedAt: document.createdAt,
          })),
        });
      }

      return {
        id: documentId,
        title: document.title,
        kind: document.kind,
        message: 'Suggestions have been added to the document',
      };
    },
  });
