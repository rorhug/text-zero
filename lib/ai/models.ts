export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'GPT-5',
    description: 'Advanced multimodal model with vision and text capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'GPT-5 Thinking',
    description:
      'Uses advanced chain-of-thought reasoning for complex problems',
  },
];
