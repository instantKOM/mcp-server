import type { ApiClient } from '@instantkom/api-client';

/**
 * Tickets Tools
 * CRUD operations for support tickets and ticket messages
 */

// ============================================================================
// Ticket CRUD Operations
// ============================================================================

export async function listTickets(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.channelId) params.append('channelId', args.channelId.toString());
  if (args.status) params.append('status', args.status);
  if (args.priority) params.append('priority', args.priority);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/tickets${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getTicket(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/tickets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTicket(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/tickets', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateTicket(apiClient: ApiClient, args: any): Promise<any> {
  const { id, channelId, ...data } = args;
  if (!channelId || typeof channelId !== 'number') {
    throw new Error('channelId is required for update_ticket');
  }
  const response = await apiClient.put(`/v1/channels/${channelId}/tickets/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteTicket(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/tickets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Ticket deleted successfully',
      },
    ],
  };
}

// ============================================================================
// Ticket Messages Operations
// ============================================================================

export async function listTicketMessages(apiClient: ApiClient, args: { ticketId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/tickets/${args.ticketId}/messages`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getTicketMessage(apiClient: ApiClient, args: { ticketId: number; messageId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/tickets/${args.ticketId}/messages/${args.messageId}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTicketMessage(apiClient: ApiClient, args: any): Promise<any> {
  const { ticketId, ...data } = args;
  const response = await apiClient.post(`/v1/tickets/${ticketId}/messages`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateTicketMessage(apiClient: ApiClient, args: any): Promise<any> {
  const { ticketId, messageId, ...data } = args;
  const response = await apiClient.put(`/v1/tickets/${ticketId}/messages/${messageId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteTicketMessage(apiClient: ApiClient, args: { ticketId: number; messageId: number }): Promise<any> {
  await apiClient.delete(`/v1/tickets/${args.ticketId}/messages/${args.messageId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Ticket message deleted successfully',
      },
    ],
  };
}

export async function replyTicket(apiClient: ApiClient, args: { ticketId: number; message: string; close?: boolean }): Promise<any> {
  const { ticketId, ...data } = args;
  const response = await apiClient.post(`/v1/tickets/${ticketId}/reply`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export const ticketTools = [
  // Ticket CRUD
  {
    name: 'list_tickets',
    description: 'List all support tickets with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
        channelId: { type: 'number', description: 'Filter by channel ID' },
        status: { type: 'string', description: 'Filter by status (new, open, pending, closed)' },
        priority: { type: 'string', description: 'Filter by priority (low, normal, high, urgent)' },
      },
    },
  },
  {
    name: 'get_ticket',
    description: 'Get a specific ticket by ID with full history',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Ticket ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new support ticket',
    inputSchema: {
      type: 'object',
      properties: {
        channelId: { type: 'number', description: 'Channel ID' },
        recipientId: { type: 'number', description: 'Contact/Recipient ID' },
        subject: { type: 'string', description: 'Ticket subject' },
        message: { type: 'string', description: 'Initial message' },
        priority: { type: 'string', description: 'Priority (low, normal, high, urgent)' },
      },
      required: ['channelId', 'recipientId', 'subject', 'message'],
    },
  },
  {
    name: 'update_ticket',
    description: 'Update a ticket (status, priority, assignment)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Ticket ID' },
        channelId: { type: 'number', description: 'Channel ID the ticket belongs to' },
        status: { type: 'string', description: 'Status (new, open, pending, closed)' },
        priority: { type: 'string', description: 'Priority (low, normal, high, urgent)' },
        assignedTo: { type: 'number', description: 'Assign to team member ID (0 to unassign)' },
        notify: {
          type: 'boolean',
          description:
            'Trigger the legacy notification chain for transitions that have one. ' +
            'When assignedTo is set/changed, fires TICKET_ASSIGN (assignee email plus ' +
            'optional customer reply). When status transitions to "closed", fires ' +
            'TICKET_CLOSE (optional customer reply driven by tickets_close_reply_sts). ' +
            'Defaults to true. Set to false for silent updates.',
        },
      },
      required: ['id', 'channelId'],
    },
  },
  {
    name: 'delete_ticket',
    description: 'Delete a ticket by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Ticket ID' },
      },
      required: ['id'],
    },
  },

  // Ticket Messages
  {
    name: 'list_ticket_messages',
    description: 'List all messages in a ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID' },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'get_ticket_message',
    description: 'Get a specific ticket message',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID' },
        messageId: { type: 'number', description: 'Message ID' },
      },
      required: ['ticketId', 'messageId'],
    },
  },
  {
    name: 'create_ticket_message',
    description: 'Add a message/reply to a ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID' },
        message: {
          type: 'string',
          description:
            'Message text. Raw body only -- DO NOT include a salutation or ' +
            'sign-off. For email-channel tickets the ticket system auto-wraps ' +
            'the body with the personalised salutation and the localised footer. ' +
            'Adding your own greetings causes duplicated headers/footers.',
        },
        internal: { type: 'boolean', description: 'Internal note (not visible to customer)' },
      },
      required: ['ticketId', 'message'],
    },
  },
  {
    name: 'update_ticket_message',
    description: 'Update a ticket message',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID' },
        messageId: { type: 'number', description: 'Message ID' },
        message: { type: 'string', description: 'Updated message text' },
      },
      required: ['ticketId', 'messageId'],
    },
  },
  {
    name: 'delete_ticket_message',
    description: 'Delete a ticket message',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID' },
        messageId: { type: 'number', description: 'Message ID' },
      },
      required: ['ticketId', 'messageId'],
    },
  },
  {
    name: 'reply_ticket',
    description:
      'Send a real support reply on a ticket. Unlike create_ticket_message ' +
      '(which only adds a row to tickets_msgs without delivery), this routes ' +
      'through the legacy ticket-reply path so the customer email is actually ' +
      'delivered and the message lands in both the ticket history and the ' +
      'Nachrichtenprotokoll.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'number', description: 'Ticket ID (`tickets.id`)' },
        message: {
          type: 'string',
          description:
            'Reply body. Raw text only -- DO NOT include a salutation or ' +
            'sign-off. For email-channel tickets the ticket system auto-wraps ' +
            'the body with the personalised salutation and the localised footer. ' +
            'Adding your own greetings causes duplicated headers/footers.',
        },
        close: {
          type: 'boolean',
          description: 'Close the ticket after sending the reply',
        },
      },
      required: ['ticketId', 'message'],
    },
  },
];
