import { z } from 'zod';

import type { DateRange } from '../queries/analytics.queries';
import * as analyticsQueries from '../queries/analytics.queries';
import { projectProtectedProcedure } from './trpc';

export const analyticsRoutes = {
	/**
	 * Get aggregated metrics summary for a date range
	 */
	getSummary: projectProtectedProcedure
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

			return analyticsQueries.getMetricsSummary(ctx.user.id, dateRange);
		}),

	/**
	 * Get daily metrics for charts
	 */
	getDailyMetrics: projectProtectedProcedure
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

			return analyticsQueries.getDailyMetrics(ctx.user.id, dateRange);
		}),

	/**
	 * Get stage statistics
	 */
	getStageStats: projectProtectedProcedure
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

			return analyticsQueries.getStageStats(ctx.user.id, dateRange);
		}),

	/**
	 * Get top errors
	 */
	getTopErrors: projectProtectedProcedure
		.input(
			z.object({
				startDate: z.string().datetime(),
				endDate: z.string().datetime(),
				limit: z.number().optional().default(10),
			}),
		)
		.query(async ({ input, ctx }) => {
			const dateRange: DateRange = {
				startDate: new Date(input.startDate),
				endDate: new Date(input.endDate),
			};

			return analyticsQueries.getTopErrors(ctx.user.id, dateRange, input.limit);
		}),

	/**
	 * Get detailed stage statistics with sample metadata
	 */
	getDetailedStageStats: projectProtectedProcedure
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

			return analyticsQueries.getDetailedStageStats(ctx.user.id, dateRange);
		}),

	/**
	 * Get error metrics for dashboard
	 */
	getErrorMetrics: projectProtectedProcedure
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

			return analyticsQueries.getErrorMetrics(ctx.user.id, dateRange);
		}),
};
