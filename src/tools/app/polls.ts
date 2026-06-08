import type { ApiClient } from '@instantkom/api-client';

/**
 * Polls Tools
 * CRUD operations for polls and poll options
 */

// ============================================================================
// Poll CRUD Operations
// ============================================================================

export async function listPolls(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/polls${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getPoll(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/polls/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createPoll(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/polls', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updatePoll(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/polls/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deletePoll(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/polls/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Poll deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Poll Options Operations
// ============================================================================

export async function listPollOptions(apiClient: ApiClient, args: { pollId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/polls/${args.pollId}/options`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getPollOption(apiClient: ApiClient, args: { pollId: number; optionId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/polls/${args.pollId}/options/${args.optionId}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createPollOption(apiClient: ApiClient, args: any): Promise<any> {
  const { pollId, ...data } = args;
  const response = await apiClient.post(`/v1/polls/${pollId}/options`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updatePollOption(apiClient: ApiClient, args: any): Promise<any> {
  const { pollId, optionId, ...data } = args;
  const response = await apiClient.put(`/v1/polls/${pollId}/options/${optionId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deletePollOption(apiClient: ApiClient, args: { pollId: number; optionId: number }): Promise<any> {
  await apiClient.delete(`/v1/polls/${args.pollId}/options/${args.optionId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Poll option deleted successfully',
      },
    ],
  };
}

export const pollTools = [
  // Poll CRUD
  {
    name: 'list_polls',
    description: 'List all polls with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
      },
    },
  },
  {
    name: 'get_poll',
    description: 'Get a specific poll by ID with results',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Poll ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_poll',
    description: 'Create a new poll',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'number', description: 'Channel ID' },
        question: { type: 'string', description: 'Poll question' },
        multipleChoice: { type: 'boolean', description: 'Allow multiple selections' },
      },
      required: ['channelId', 'question'],
    },
  },
  {
    name: 'update_poll',
    description: 'Update an existing poll',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Poll ID' },
        question: { type: 'string', description: 'Poll question' },
        multipleChoice: { type: 'boolean', description: 'Allow multiple selections' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_poll',
    description: 'Delete a poll by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Poll ID' },
      },
      required: ['id'],
    },
  },

  // Poll Options
  {
    name: 'list_poll_options',
    description: 'List all options for a poll',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'number', description: 'Poll ID' },
      },
      required: ['pollId'],
    },
  },
  {
    name: 'get_poll_option',
    description: 'Get a specific poll option',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'number', description: 'Poll ID' },
        optionId: { type: 'number', description: 'Option ID' },
      },
      required: ['pollId', 'optionId'],
    },
  },
  {
    name: 'create_poll_option',
    description: 'Create a new option for a poll',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'number', description: 'Poll ID' },
        text: { type: 'string', description: 'Option text' },
      },
      required: ['pollId', 'text'],
    },
  },
  {
    name: 'update_poll_option',
    description: 'Update a poll option',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'number', description: 'Poll ID' },
        optionId: { type: 'number', description: 'Option ID' },
        text: { type: 'string', description: 'Option text' },
      },
      required: ['pollId', 'optionId'],
    },
  },
  {
    name: 'delete_poll_option',
    description: 'Delete a poll option',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'number', description: 'Poll ID' },
        optionId: { type: 'number', description: 'Option ID' },
      },
      required: ['pollId', 'optionId'],
    },
  },
];
