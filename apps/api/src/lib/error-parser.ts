/**
 * Error parsing utilities for n8n execution errors
 * Extracts structured information from error messages
 */

export interface ParsedError {
  nodeName: string | null;
  nodeType: string | null;
  errorType: string;
  shortMessage: string;
  fullMessage: string;
  httpStatus: number | null;
  suggestion: string | null;
}

// Common n8n error patterns
const ERROR_PATTERNS = [
  // Node execution error: "NodeOperationError: Node 'HTTP Request' Error: Request failed with status code 404"
  {
    regex: /NodeOperationError:\s*Node\s*'([^']+)'.*?Error:\s*(.+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      nodeName: match[1],
      errorType: 'NodeOperationError',
      shortMessage: match[2].split('\n')[0].trim(),
    }),
  },
  // API/HTTP errors: "Request failed with status code 401"
  {
    regex: /Request failed with status code (\d+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'HTTPError',
      httpStatus: parseInt(match[1], 10),
      shortMessage: `HTTP ${match[1]} Error`,
    }),
  },
  // Credential errors
  {
    regex: /credential[s]?\s*(not found|invalid|expired|missing)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'CredentialError',
      shortMessage: `Credential ${match[1]}`,
      suggestion: 'Check your credentials in n8n settings',
    }),
  },
  // Connection errors
  {
    regex: /(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection\s*refused)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'ConnectionError',
      shortMessage: 'Connection failed',
      suggestion: 'Check if the target service is running and accessible',
    }),
  },
  // Validation errors
  {
    regex: /validation\s*(?:error|failed):\s*(.+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'ValidationError',
      shortMessage: match[1].split('\n')[0].trim(),
    }),
  },
  // Expression errors
  {
    regex: /expression\s*(?:error|failed):\s*(.+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'ExpressionError',
      shortMessage: match[1].split('\n')[0].trim(),
      suggestion: 'Check your expression syntax in the node',
    }),
  },
  // Timeout errors
  {
    regex: /(timeout|timed?\s*out)/i,
    extract: (): Partial<ParsedError> => ({
      errorType: 'TimeoutError',
      shortMessage: 'Operation timed out',
      suggestion: 'Consider increasing the timeout or optimizing the operation',
    }),
  },
  // Rate limit errors
  {
    regex: /(rate\s*limit|too\s*many\s*requests|429)/i,
    extract: (): Partial<ParsedError> => ({
      errorType: 'RateLimitError',
      httpStatus: 429,
      shortMessage: 'Rate limit exceeded',
      suggestion: 'Add delays between requests or reduce batch size',
    }),
  },
  // Authentication errors
  {
    regex: /(unauthorized|authentication\s*failed|401|403)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedError> => ({
      errorType: 'AuthenticationError',
      httpStatus: match[0].includes('401') ? 401 : match[0].includes('403') ? 403 : null,
      shortMessage: 'Authentication failed',
      suggestion: 'Verify your API keys and permissions',
    }),
  },
];

// Node name extraction patterns
const NODE_PATTERNS = [
  /Node\s*['"]([^'"]+)['"]/i,
  /node\s*:\s*['"]?([^'"}\s,]+)['"]?/i,
  /in\s+['"]([^'"]+)['"]\s+node/i,
];

/**
 * Parse an n8n error message into structured data
 */
export function parseN8nError(errorMessage: string | null): ParsedError {
  if (!errorMessage) {
    return {
      nodeName: null,
      nodeType: null,
      errorType: 'Unknown',
      shortMessage: 'No error message available',
      fullMessage: '',
      httpStatus: null,
      suggestion: null,
    };
  }

  let result: ParsedError = {
    nodeName: null,
    nodeType: null,
    errorType: 'Unknown',
    shortMessage: errorMessage.split('\n')[0].substring(0, 100),
    fullMessage: errorMessage,
    httpStatus: null,
    suggestion: null,
  };

  // Try each error pattern
  for (const pattern of ERROR_PATTERNS) {
    const match = errorMessage.match(pattern.regex);
    if (match) {
      const extracted = pattern.extract(match);
      result = { ...result, ...extracted };
      break;
    }
  }

  // Try to extract node name if not already found
  if (!result.nodeName) {
    for (const pattern of NODE_PATTERNS) {
      const match = errorMessage.match(pattern);
      if (match) {
        result.nodeName = match[1];
        break;
      }
    }
  }

  // Add suggestions based on error type if not already set
  if (!result.suggestion) {
    result.suggestion = getSuggestionForErrorType(result.errorType, result.httpStatus);
  }

  return result;
}

/**
 * Get a helpful suggestion based on error type
 */
function getSuggestionForErrorType(errorType: string, httpStatus: number | null): string | null {
  const suggestions: Record<string, string> = {
    HTTPError: httpStatus
      ? getHttpStatusSuggestion(httpStatus)
      : 'Check the API endpoint and request parameters',
    NodeOperationError: 'Review the node configuration and input data',
    CredentialError: 'Update or reconnect your credentials in n8n',
    ConnectionError: 'Verify network connectivity and service availability',
    ValidationError: 'Check input data format and required fields',
    ExpressionError: 'Review expression syntax and referenced data',
    TimeoutError: 'Increase timeout settings or optimize the operation',
    RateLimitError: 'Add Wait nodes or reduce request frequency',
    AuthenticationError: 'Re-authenticate or check API permissions',
  };

  return suggestions[errorType] || null;
}

/**
 * Get suggestion based on HTTP status code
 */
function getHttpStatusSuggestion(status: number): string {
  if (status === 400) return 'Check request body and parameters';
  if (status === 401) return 'Authentication required - check credentials';
  if (status === 403) return 'Access forbidden - check permissions';
  if (status === 404) return 'Resource not found - verify the URL';
  if (status === 429) return 'Too many requests - add delays';
  if (status >= 500) return 'Server error - try again later';
  return 'Check the API documentation for this status code';
}

/**
 * Get error severity level
 */
export function getErrorSeverity(errorType: string): 'critical' | 'warning' | 'info' {
  const critical = ['AuthenticationError', 'CredentialError', 'ConnectionError'];
  const warning = ['RateLimitError', 'TimeoutError', 'ValidationError'];
  
  if (critical.includes(errorType)) return 'critical';
  if (warning.includes(errorType)) return 'warning';
  return 'info';
}

/**
 * Get a color class for the error type
 */
export function getErrorColor(errorType: string): string {
  const colors: Record<string, string> = {
    HTTPError: 'text-orange-500',
    NodeOperationError: 'text-red-500',
    CredentialError: 'text-red-600',
    ConnectionError: 'text-red-500',
    ValidationError: 'text-yellow-500',
    ExpressionError: 'text-purple-500',
    TimeoutError: 'text-orange-500',
    RateLimitError: 'text-yellow-600',
    AuthenticationError: 'text-red-600',
    Unknown: 'text-gray-500',
  };
  
  return colors[errorType] || colors.Unknown;
}

/**
 * Group errors by type for summary
 */
export function groupErrorsByType(errors: ParsedError[]): Record<string, ParsedError[]> {
  return errors.reduce((acc, error) => {
    const type = error.errorType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(error);
    return acc;
  }, {} as Record<string, ParsedError[]>);
}

/**
 * Get error icon name based on type
 */
export function getErrorIcon(errorType: string): string {
  const icons: Record<string, string> = {
    HTTPError: 'Globe',
    NodeOperationError: 'AlertCircle',
    CredentialError: 'Key',
    ConnectionError: 'WifiOff',
    ValidationError: 'FileWarning',
    ExpressionError: 'Code',
    TimeoutError: 'Clock',
    RateLimitError: 'Gauge',
    AuthenticationError: 'Shield',
    Unknown: 'AlertTriangle',
  };
  
  return icons[errorType] || icons.Unknown;
}



