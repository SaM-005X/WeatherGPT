/**
 * Root Resolvers Aggregator
 *
 * Merges domain resolvers into a single root resolvers map for the GraphQL server.
 */

import { weatherResolvers } from './weatherResolvers';
import { locationResolvers } from './locationResolvers';

export const resolvers = {
  Query: {
    ...weatherResolvers.Query,
    ...locationResolvers.Query,
  },
  Mutation: {
    ...weatherResolvers.Mutation,
  },
};
