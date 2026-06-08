import type { ApiClient } from '@instantkom/api-client';

/**
 * Dashboard Widgets Tools
 * Dashboard widget types and user widget management
 */

export async function getDashboardOverview(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get('/v1/dashboard');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getDashboardWidgetTypes(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get('/v1/dashboard/widget-types');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function listDashboardWidgets(apiClient: ApiClient, _args: any): Promise<any> {
  const response = await apiClient.get('/v1/dashboard/widgets');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function getDashboardWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  const response = await apiClient.get(`/v1/dashboard/widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function addDashboardWidget(apiClient: ApiClient, args: any): Promise<any> {
  const response = await apiClient.post('/v1/dashboard/widgets', args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function updateDashboardWidget(apiClient: ApiClient, args: any): Promise<any> {
  const { id, ...data } = args;
  const response = await apiClient.put(`/v1/dashboard/widgets/${id}`, data);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

export async function removeDashboardWidget(apiClient: ApiClient, args: { id: number }): Promise<any> {
  await apiClient.delete(`/v1/dashboard/widgets/${args.id}`);

  return {
    content: [
      {
        type: 'text',
        text: 'Dashboard widget removed successfully',
      },
    ],
  };
}

export const dashboardWidgetTools = [
  {
    name: 'get_dashboard_overview',
    description: 'Get dashboard overview with widgets and widget types',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_dashboard_widget_types',
    description: 'Get all available dashboard widget types that can be added to the dashboard',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_dashboard_widgets',
    description: "Get all widgets configured on the user's dashboard, ordered by position",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_dashboard_widget',
    description: 'Get a specific dashboard widget by ID with position, size, and type details',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget instance ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_dashboard_widget',
    description: 'Add a new widget to the dashboard. Specify widget type and optional position/size.',
    inputSchema: {
      type: 'object',
      properties: {
        widgetTypeId: { type: 'number', description: 'Widget type ID' },
        positionX: { type: 'number', description: 'X position on grid' },
        positionY: { type: 'number', description: 'Y position on grid' },
        width: { type: 'number', description: 'Widget width in grid units' },
        height: { type: 'number', description: 'Widget height in grid units' },
        visible: { type: 'boolean', description: 'Widget visibility' },
      },
      required: ['widgetTypeId'],
    },
  },
  {
    name: 'update_dashboard_widget',
    description: "Update a widget's position, size, or visibility on the dashboard",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget instance ID' },
        positionX: { type: 'number', description: 'X position on grid' },
        positionY: { type: 'number', description: 'Y position on grid' },
        width: { type: 'number', description: 'Widget width in grid units' },
        height: { type: 'number', description: 'Widget height in grid units' },
        visible: { type: 'boolean', description: 'Widget visibility' },
      },
      required: ['id'],
    },
  },
  {
    name: 'remove_dashboard_widget',
    description: 'Remove a widget from the dashboard. Some widgets may be non-removable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Widget instance ID' },
      },
      required: ['id'],
    },
  },
];
