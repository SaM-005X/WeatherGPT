/**
 * Lightweight Typed GraphQL Client
 *
 * Executes GraphQL queries and mutations via standard Web fetch.
 * Designed without heavy state normalization dependencies (zero Apollo bloat)
 * to keep single source of truth intact and support seamless React 19 hydration.
 */

export interface GraphQLClientOptions {
  signal?: AbortSignal;
  endpoint?: string;
  headers?: Record<string, string>;
}

export interface GraphQLErrorItem {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLErrorItem[];
}

export class GraphQLClientError extends Error {
  public errors?: GraphQLErrorItem[];

  constructor(message: string, errors?: GraphQLErrorItem[]) {
    super(message);
    this.name = 'GraphQLClientError';
    this.errors = errors;
  }
}

export function getGraphQLEndpoint(): string {
  if (process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_APPSYNC_GRAPHQL_URL;
  }
  if (process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT) {
    return process.env.NEXT_PUBLIC_APPSYNC_ENDPOINT;
  }
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  }
  if (typeof window !== 'undefined') {
    return '/api/graphql';
  }
  return 'http://localhost:3000/api/graphql';
}

export async function executeGraphQL<TData, TVariables = Record<string, unknown>>(
  query: string,
  variables?: TVariables,
  options?: GraphQLClientOptions
): Promise<TData> {
  const endpoint = options?.endpoint || getGraphQLEndpoint();
  const apiKey = process.env.NEXT_PUBLIC_APPSYNC_API_KEY;

  let response: Response;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...options?.headers,
    };

    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables,
      }),
      signal: options?.signal,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network failure';
    throw new GraphQLClientError(`GraphQL network error: ${message}`);
  }

  if (!response.ok) {
    throw new GraphQLClientError(`GraphQL HTTP error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as GraphQLResponse<TData>;

  if (result.errors && result.errors.length > 0) {
    const errorMsg = result.errors.map((e) => e.message).join('; ');
    throw new GraphQLClientError(errorMsg, result.errors);
  }

  if (!result.data) {
    throw new GraphQLClientError('GraphQL response returned empty data.');
  }

  return result.data;
}
