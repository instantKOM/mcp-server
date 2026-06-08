import type { ApiClient } from '@instantkom/api-client';

export async function generateAiReply(
  apiClient: ApiClient,
  args: {
    messageId: number;
    limit?: number;
    contextLength?: number;
    style?: string;
  },
): Promise<any> {
  const response = await apiClient.post('/v1/ai/reply', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const aiTools = [
  {
    name: 'generate_ai_reply',
    description: 'Generate AI smart reply suggestions for a message',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'number',
          description: 'Message ID to use as smart-reply anchor',
        },
        limit: {
          type: 'number',
          description: 'Number of suggestions to generate (1-5)',
        },
        contextLength: {
          type: 'number',
          description: 'Number of recent messages to use as context (1-20)',
        },
        style: {
          type: 'string',
          description: 'Response style',
          enum: [
            'professional',
            'friendly',
            'concise',
            'detailed',
            'empathetic',
          ],
        },
      },
      required: ['messageId'],
    },
  },
];
