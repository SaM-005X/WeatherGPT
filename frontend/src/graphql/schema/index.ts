/**
 * Executable GraphQL Schema Definition
 *
 * Combines SDL typeDefs and root resolvers using createSchema.
 * Exported for use in Next.js route handlers, unit testing, and future AWS Lambda handlers.
 */

import { createSchema } from 'graphql-yoga';
import { typeDefs } from './typeDefs';
import { resolvers } from '../resolvers';

export const schema = createSchema({
  typeDefs,
  resolvers,
});

export { typeDefs, resolvers };
