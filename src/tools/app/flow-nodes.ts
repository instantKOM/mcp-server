import type { ApiClient } from '@instantkom/api-client';

/**
 * Flow Nodes Tools
 * CRUD operations for nodes (bot placements) within flows
 */

export async function listFlowNodes(apiClient: ApiClient, args: { flowId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/flows/${args.flowId}/nodes`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getFlowNode(apiClient: ApiClient, args: { flowId: number; nodeId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/flows/${args.flowId}/nodes/${args.nodeId}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createFlowNode(apiClient: ApiClient, args: any): Promise<any> {
  const { flowId, ...data } = args;
  const response = await apiClient.post(`/v1/flows/${flowId}/nodes`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateFlowNode(apiClient: ApiClient, args: any): Promise<any> {
  const { flowId, nodeId, ...data } = args;
  const response = await apiClient.put(`/v1/flows/${flowId}/nodes/${nodeId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteFlowNode(apiClient: ApiClient, args: { flowId: number; nodeId: number }): Promise<any> {
  await apiClient.delete(`/v1/flows/${args.flowId}/nodes/${args.nodeId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Flow node deleted successfully',
      },
    ],
  };
}

export const flowNodeTools = [
  {
    name: 'list_flow_nodes',
    description: 'List all nodes (bot placements) in a specific flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
      },
      required: ['flowId'],
    },
  },
  {
    name: 'get_flow_node',
    description: 'Get a specific node in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        nodeId: { type: 'number', description: 'Node ID' },
      },
      required: ['flowId', 'nodeId'],
    },
  },
  {
    name: 'create_flow_node',
    description: 'Add a bot as a node in a flow. The bot must belong to the same channel as the flow.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        botId: { type: 'number', description: 'Bot ID to place in the flow' },
        type: { type: 'string', description: 'Node type' },
        positionX: { type: 'number', description: 'X position on canvas' },
        positionY: { type: 'number', description: 'Y position on canvas' },
      },
      required: ['flowId', 'botId'],
    },
  },
  {
    name: 'update_flow_node',
    description: 'Update node position, type, or associated bot',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        nodeId: { type: 'number', description: 'Node ID' },
        botId: { type: 'number', description: 'Bot ID' },
        type: { type: 'string', description: 'Node type' },
        positionX: { type: 'number', description: 'X position on canvas' },
        positionY: { type: 'number', description: 'Y position on canvas' },
      },
      required: ['flowId', 'nodeId'],
    },
  },
  {
    name: 'delete_flow_node',
    description: 'Remove a node from a flow. Also removes connected edges. The bot is not deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        nodeId: { type: 'number', description: 'Node ID' },
      },
      required: ['flowId', 'nodeId'],
    },
  },
];
