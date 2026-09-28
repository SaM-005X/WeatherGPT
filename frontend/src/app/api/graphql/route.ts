/**
 * Next.js App Router GraphQL Gateway Route Handler
 *
 * Serves the internal GraphQL API endpoint at /api/graphql.
 * Provides interactive GraphiQL development interface in the browser.
 */

import { createYoga } from 'graphql-yoga';
import { schema } from '@/graphql/schema';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  fetchAPI: { Response },
});

export async function GET(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function POST(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function OPTIONS(request: Request) {
  return yoga.handleRequest(request, {});
}
