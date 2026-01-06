import crypto from 'crypto';

/**
 * Compute SHA-256 hash of workflow JSON content
 * We normalize the JSON to ensure consistent hashing
 */
export function computeWorkflowHash(jsonContent: unknown): string {
  // Sort keys for consistent hashing
  const normalized = JSON.stringify(jsonContent, Object.keys(jsonContent as object).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Deep sort an object's keys for consistent JSON stringification
 */
export function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  
  return sorted;
}

/**
 * Compute hash with deep key sorting for nested objects
 */
export function computeDeepHash(jsonContent: unknown): string {
  const sorted = sortObjectKeys(jsonContent);
  const normalized = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}



