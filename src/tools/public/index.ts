/**
 * Public Tools - Index
 * Aggregates all public tools
 */

import { healthTools } from './health.js';
import { deviceFlowTools } from './device-flow.js';

export { getHealth, healthTools } from './health.js';
export {
  startDeviceFlow,
  pollDeviceToken,
  approveDeviceFlow,
  deviceFlowTools,
} from './device-flow.js';

export const publicTools = [...healthTools, ...deviceFlowTools];
