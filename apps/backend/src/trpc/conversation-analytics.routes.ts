import { z } from 'zod';

import type { DateRange } from '../queries/analytics.queries';
import * as conversationAnalyticsQueries from '../queries/conversation-analytics.queries';
import { projectProtectedProcedure } from './trpc';

export const conversationAnalyticsRoutes = {
	/**
	 * Get conversation metrics
	 */
	getConversationMetrics: projectProtectedProcedure
		.input(
			z.object({
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const dateRange: DateRange = {
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
			};

			return conversationAnalyticsQueries.getConversationMetrics(ctx.user.id, dateRange);
		}),

	/**
	 * Get individual conversation statistics
	 */
	getConversationStats: projectProtectedProcedure
		.input(
			z.object({
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
				limit: z.number().optional().default(50),
			}),
		)
		.query(async ({ input, ctx }) => {
			const dateRange: DateRange = {
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
			};

			return conversationAnalyticsQueries.getConversationStats(ctx.user.id, dateRange, input.limit);
		}),

	/**
	 * Get conversation trends
	 */
	getConversationTrends: projectProtectedProcedure
		.input(
			z.object({
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const dateRange: DateRange = {
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
			};

			return conversationAnalyticsQueries.getConversationTrends(ctx.user.id, dateRange);
		}),
};
