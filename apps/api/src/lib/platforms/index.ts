/**
 * Multi-Platform Automation Support
 * 
 * This module provides a unified interface for interacting with different
 * workflow automation platforms like n8n, Make (Integromat), Activepieces, etc.
 * 
 * Usage:
 * ```typescript
 * import { createPlatformAdapter } from './platforms';
 * 
 * const adapter = createPlatformAdapter({
 *   type: 'n8n',
 *   baseUrl: 'http://localhost:5678',
 *   apiKey: 'your-api-key',
 * });
 * 
 * const workflows = await adapter.listWorkflows();
 * ```
 */

// Export types
export * from './types.js';

// Export adapters
export { N8nAdapter, createN8nAdapter } from './n8n-adapter.js';
export { MakeAdapter, createMakeAdapter } from './make-adapter.js';
export { ActivepiecesAdapter, createActivepiecesAdapter } from './activepieces-adapter.js';

import type { IAutomationPlatform, PlatformConfig, PlatformType } from './types.js';
import { N8nAdapter } from './n8n-adapter.js';
import { MakeAdapter } from './make-adapter.js';
import { ActivepiecesAdapter } from './activepieces-adapter.js';

/**
 * Factory function to create the appropriate platform adapter
 */
export function createPlatformAdapter(config: PlatformConfig): IAutomationPlatform {
  switch (config.type) {
    case 'n8n':
      return new N8nAdapter(config);
    case 'make':
      return new MakeAdapter(config);
    case 'activepieces':
      return new ActivepiecesAdapter(config);
    case 'zapier':
      throw new Error('Zapier adapter not yet implemented. Zapier API has limited workflow access.');
    case 'nodered':
      throw new Error('Node-RED adapter not yet implemented.');
    case 'pipedream':
      throw new Error('Pipedream adapter not yet implemented.');
    default:
      throw new Error(`Unknown platform type: ${config.type}`);
  }
}

/**
 * Check if a platform type is supported
 */
export function isPlatformSupported(type: PlatformType): boolean {
  const supported: PlatformType[] = ['n8n', 'make', 'activepieces'];
  return supported.includes(type);
}

/**
 * Get list of all supported platforms
 */
export function getSupportedPlatforms(): PlatformType[] {
  return ['n8n', 'make', 'activepieces'];
}

/**
 * Get list of all platforms (including not yet supported)
 */
export function getAllPlatforms(): PlatformType[] {
  return ['n8n', 'make', 'zapier', 'activepieces', 'nodered', 'pipedream'];
}



