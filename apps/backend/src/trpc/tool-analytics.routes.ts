import { z } from 'zod';

import type { DateRange } from '../queries/analytics.queries';
import * as toolAnalyticsQueries from '../queries/tool-analytics.queries';
import { projectProtectedProcedure } from './trpc';

export const toolAnalyticsRoutes = {
	/**
	 * Get tool usage statistics
	 */
	getToolUsageStats: projectProtectedProcedure
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

			return toolAnalyticsQueries.getToolUsageStats(ctx.user.id, dateRange);
		}),

	/**
	 * Get tool performance trends
	 */
	getToolPerformanceTrends: projectProtectedProcedure
		.input(
			z.object({
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
				topN: z.number().optional().default(5),
			}),
		)
		.query(async ({ input, ctx }) => {
			const dateRange: DateRange = {
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
			};

			return toolAnalyticsQueries.getToolPerformanceTrends(ctx.user.id, dateRange, input.topN);
		}),

	/**
	 * Get tool error breakdown
	 */
	getToolErrorBreakdown: projectProtectedProcedure
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

			return toolAnalyticsQueries.getToolErrorBreakdown(ctx.user.id, dateRange);
		}),
};
