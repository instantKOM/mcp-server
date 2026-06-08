import type { ApiClient } from '@instantkom/api-client';

/**
 * Flow Edges Tools
 * CRUD operations for edges (connections between nodes) within flows
 */

export async function listFlowEdges(apiClient: ApiClient, args: { flowId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/flows/${args.flowId}/edges`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getFlowEdge(apiClient: ApiClient, args: { flowId: number; edgeId: number }): Promise<any> {
  const response = await apiClient.get(`/v1/flows/${args.flowId}/edges/${args.edgeId}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function createFlowEdge(apiClient: ApiClient, args: any): Promise<any> {
  const { flowId, ...data } = args;
  const response = await apiClient.post(`/v1/flows/${flowId}/edges`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateFlowEdge(apiClient: ApiClient, args: any): Promise<any> {
  const { flowId, edgeId, ...data } = args;
  const response = await apiClient.put(`/v1/flows/${flowId}/edges/${edgeId}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function deleteFlowEdge(apiClient: ApiClient, args: { flowId: number; edgeId: number }): Promise<any> {
  await apiClient.delete(`/v1/flows/${args.flowId}/edges/${args.edgeId}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Flow edge deleted successfully',
      },
    ],
  };
}

export const flowEdgeTools = [
  {
    name: 'list_flow_edges',
    description: 'List all edges (connections between nodes) in a specific flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
      },
      required: ['flowId'],
    },
  },
  {
    name: 'get_flow_edge',
    description: 'Get a specific edge in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        edgeId: { type: 'number', description: 'Edge ID' },
      },
      required: ['flowId', 'edgeId'],
    },
  },
  {
    name: 'create_flow_edge',
    description: 'Create a connection between two nodes in a flow. Both nodes must exist in the same flow.',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        sourceNodeId: { type: 'number', description: 'Source node ID' },
        targetNodeId: { type: 'number', description: 'Target node ID' },
        label: { type: 'string', description: 'Edge label' },
        type: { type: 'string', description: 'Edge type' },
      },
      required: ['flowId', 'sourceNodeId', 'targetNodeId'],
    },
  },
  {
    name: 'update_flow_edge',
    description: 'Update edge properties like source/target nodes, label, or type',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        edgeId: { type: 'number', description: 'Edge ID' },
        sourceNodeId: { type: 'number', description: 'Source node ID' },
        targetNodeId: { type: 'number', description: 'Target node ID' },
        label: { type: 'string', description: 'Edge label' },
        type: { type: 'string', description: 'Edge type' },
      },
      required: ['flowId', 'edgeId'],
    },
  },
  {
    name: 'delete_flow_edge',
    description: 'Remove a connection between nodes in a flow',
    inputSchema: {
      type: 'object',
      properties: {
        flowId: { type: 'number', description: 'Flow ID' },
        edgeId: { type: 'number', description: 'Edge ID' },
      },
      required: ['flowId', 'edgeId'],
    },
  },
];
