import type { InferSelectModel } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import type { LanguageModelV2Usage } from '@ai-sdk/provider';

export const user = sqliteTable('User', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  email: text('email', { length: 64 }).notNull(),
  password: text('password', { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = sqliteTable('Chat', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  visibility: text('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  lastContext: text('lastContext', { mode: 'json' }).$type<LanguageModelV2Usage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = sqliteTable('Message', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  content: text('content', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = sqliteTable('Message_v2', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  parts: text('parts', { mode: 'json' }).notNull(),
  attachments: text('attachments', { mode: 'json' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = sqliteTable(
  'Vote',
  {
    chatId: text('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: text('messageId')
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = sqliteTable(
  'Vote_v2',
  {
    chatId: text('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: text('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = sqliteTable(
  'Document',
  {
    id: text('id').notNull().$defaultFn(() => crypto.randomUUID()),
    createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: text('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: text('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = sqliteTable('Suggestion', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  documentId: text('documentId').notNull(),
  documentCreatedAt: integer('documentCreatedAt', { mode: 'timestamp' }).notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: integer('isResolved', { mode: 'boolean' }).notNull().default(false),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = sqliteTable('Stream', {
  id: text('id').primaryKey().notNull().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type Stream = InferSelectModel<typeof stream>;

export const userSettings = sqliteTable('UserSettings', {
  userId: text('userId').primaryKey().notNull().references(() => user.id),
  suggestionPrompt: text('suggestionPrompt'),
  followUpPrompt: text('followUpPrompt'),
  messageLimit: integer('messageLimit').default(30),
  suggestionsLimit: integer('suggestionsLimit').default(3),
  conversationsLimit: integer('conversationsLimit').default(10),
  followUpTimeLimit: integer('followUpTimeLimit').default(5), // in minutes
  followUpTimeUnit: text('followUpTimeUnit').default('minutes'), // 'minutes', 'hours', 'days'
  afterMessageAction: text('afterMessageAction').default('stay'), // 'stay', 'back_to_inbox', 'next_conversation'
  // Reminder settings (only tomorrow times are configurable)
  remindTomorrowMorning: text('remindTomorrowMorning').default('09:00'), // 9 AM
  remindTomorrowMidday: text('remindTomorrowMidday').default('12:00'), // 12 PM
  remindTomorrowEvening: text('remindTomorrowEvening').default('18:00'), // 6 PM
  dismissOnIncomingMessage: integer('dismissOnIncomingMessage').default(1), // 1 = true, 0 = false
});

export type UserSettings = InferSelectModel<typeof userSettings>;
