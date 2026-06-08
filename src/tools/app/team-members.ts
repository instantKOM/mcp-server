import type { ApiClient } from '@instantkom/api-client';

/**
 * Team Members Tools
 * Team collaboration and member management
 */

export async function listTeamMembers(apiClient: ApiClient, args: any): Promise<any> {
  const params = new URLSearchParams();
  if (args.page) params.append('page', args.page.toString());
  if (args.limit) params.append('limit', args.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/v1/team-members${query}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getTeamMember(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/team-members/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function inviteTeamMember(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/team-members/invite', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateTeamMember(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/team-members/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeTeamMember(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/team-members/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Team member removed successfully',
      },
    ],
  };
}

// ============================================================================
// V1 Team API (Public API for guest users)
// ============================================================================

export async function listTeam(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get('/v1/team');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createTeamMember(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/team', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteTeamMemberById(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/team/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Team member deleted successfully',
      },
    ],
  };
}

export const teamMemberTools = [
  {
    name: 'list_team_members',
    description: 'List all team members',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Items per page (default: 10)' },
      },
    },
  },
  {
    name: 'get_team_member',
    description: 'Get a specific team member by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Team member ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'invite_team_member',
    description: 'Invite a new team member',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        role: { type: 'string', description: 'Role (admin, member, viewer)' },
      },
      required: ['email', 'role'],
    },
  },
  {
    name: 'update_team_member',
    description: 'Update team member permissions',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Team member ID' },
        role: { type: 'string', description: 'Role (admin, member, viewer)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'remove_team_member',
    description: 'Remove a team member',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Team member ID' },
      },
      required: ['id'],
    },
  },

  // V1 Team API (Public API)
  {
    name: 'list_team',
    description: 'List all team members (guest users) via Public API',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_team_member',
    description: 'Create a new team member (guest user) via Public API',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address' },
        name: { type: 'string', description: 'Full name' },
        role: { type: 'string', description: 'Role' },
      },
      required: ['email'],
    },
  },
  {
    name: 'delete_team_member_by_id',
    description: 'Delete a team member by ID via Public API',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Team member ID' },
      },
      required: ['id'],
    },
  },
];
