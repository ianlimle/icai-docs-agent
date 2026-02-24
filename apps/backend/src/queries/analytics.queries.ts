import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '../db/db';
import { chat, chatMessage, errors, stageTelemetry } from '../db/pg-schema';

/**
 * Date range filter for analytics queries
 */
export interface DateRange {
	startDate: Date;
	endDate: Date;
}

/**
 * Metrics aggregation over a date range
 */
export interface MetricsSummary {
	totalMessages: number;
	totalCost: number;
	totalTokens: number;
	averageTtftMs: number;
	averageLatencyMs: number;
	averageCostPerMessage: number;
	stageSuccessRate: number;
}

/**
 * Daily metrics for charts
 */
export interface DailyMetrics {
	date: string; // YYYY-MM-DD
	messageCount: number;
	totalCost: number;
	totalTokens: number;
	averageTtftMs: number;
	averageLatencyMs: number;
}

/**
 * Stage statistics over time period
 */
export interface StageStats {
	stage: string;
	total: number;
	success: number;
	failure: number;
	successRate: number;
	averageDurationMs: number;
}

/**
 * Top error messages
 */
export interface ErrorStats {
	errorMessage: string;
	count: number;
	stage: string;
}

/**
 * Detailed stage statistics with sample metadata
 */
export interface DetailedStageStats {
	stage: string;
	total: number;
	success: number;
	failure: number;
	successRate: number;
	averageDurationMs: number;
	sampleMetadata: Array<{
		toolName?: string;
		modelId?: string;
		providerId?: string;
		outputSize?: number;
		retrievedCount?: number;
	} | null>;
}

/**
 * Get aggregated metrics for a date range
 */
export async function getMetricsSummary(userId: string, dateRange: DateRange): Promise<MetricsSummary> {
	const { startDate, endDate } = dateRange;

	const result = await db
		.select({
			totalMessages: count(chatMessage.id),
			totalCost: sql<number>`COALESCE(SUM(${chatMessage.estimatedCost} / 1000000.0), 0)`, // Convert from micro-units
			totalTokens: sql<number>`COALESCE(SUM(${chatMessage.totalTokens}), 0)`,
			averageTtftMs: sql<number>`COALESCE(AVG(${chatMessage.ttftMs}), 0)`,
			averageLatencyMs: sql<number>`COALESCE(AVG(${chatMessage.totalLatencyMs}), 0)`,
		})
		.from(chatMessage)
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)),
		);

	const stageResult = await db
		.select({
			success: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'success' THEN 1 END`),
			total: count(),
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)),
		);

	const stageSuccessRate = stageResult[0].total > 0 ? stageResult[0].success / stageResult[0].total : 1;

	return {
		totalMessages: result[0].totalMessages,
		totalCost: result[0].totalCost,
		totalTokens: result[0].totalTokens,
		averageTtftMs: Math.round(result[0].averageTtftMs || 0),
		averageLatencyMs: Math.round(result[0].averageLatencyMs || 0),
		averageCostPerMessage: result[0].totalMessages > 0 ? result[0].totalCost / result[0].totalMessages : 0,
		stageSuccessRate,
	};
}

/**
 * Get daily metrics for charts
 */
export async function getDailyMetrics(userId: string, dateRange: DateRange): Promise<DailyMetrics[]> {
	const { startDate, endDate } = dateRange;

	const result = await db
		.select({
			date: sql<string>`DATE(${chatMessage.createdAt})`,
			messageCount: count(chatMessage.id),
			totalCost: sql<number>`COALESCE(SUM(${chatMessage.estimatedCost} / 1000000.0), 0)`,
			totalTokens: sql<number>`COALESCE(SUM(${chatMessage.totalTokens}), 0)`,
			averageTtftMs: sql<number>`COALESCE(AVG(${chatMessage.ttftMs}), 0)`,
			averageLatencyMs: sql<number>`COALESCE(AVG(${chatMessage.totalLatencyMs}), 0)`,
		})
		.from(chatMessage)
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(sql`DATE(${chatMessage.createdAt})`)
		.orderBy(sql`DATE(${chatMessage.createdAt})`);

	return result.map((row) => ({
		date: row.date,
		messageCount: Number(row.messageCount),
		totalCost: Number(row.totalCost),
		totalTokens: Number(row.totalTokens),
		averageTtftMs: Math.round(Number(row.averageTtftMs)),
		averageLatencyMs: Math.round(Number(row.averageLatencyMs)),
	}));
}

/**
 * Get stage statistics by type
 */
export async function getStageStats(userId: string, dateRange: DateRange): Promise<StageStats[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			stage: stageTelemetry.stage,
			total: count(),
			success: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'success' THEN 1 END`),
			averageDurationMs: sql<number>`COALESCE(AVG(${stageTelemetry.durationMs}), 0)`,
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(stageTelemetry.stage)
		.orderBy(desc(count()));

	return result.map(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		(row: any) => {
			const total = Number(row.total);
			const success = Number(row.success);
			return {
				stage: String(row.stage),
				total,
				success,
				failure: total - success,
				successRate: total > 0 ? success / total : 1,
				averageDurationMs: Math.round(Number(row.averageDurationMs)),
			};
		},
	);
}

/**
 * Get top error messages
 */
export async function getTopErrors(userId: string, dateRange: DateRange, limit = 10): Promise<ErrorStats[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			errorMessage: stageTelemetry.errorMessage,
			count: count(),
			stage: stageTelemetry.stage,
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(
				eq(chat.userId, userId),
				eq(stageTelemetry.status, 'failure'),
				gte(chatMessage.createdAt, startDate),
				lte(chatMessage.createdAt, endDate),
				sql`${stageTelemetry.errorMessage} IS NOT NULL`,
			),
		)
		.groupBy(stageTelemetry.errorMessage, stageTelemetry.stage)
		.orderBy(desc(count()))
		.limit(limit);

	return result.map(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		(row: any) => ({
			errorMessage: String(row.errorMessage ?? 'Unknown error'),
			count: Number(row.count),
			stage: String(row.stage),
		}),
	);
}

/**
 * Get detailed stage statistics with sample metadata for hover tooltips
 */
export async function getDetailedStageStats(userId: string, dateRange: DateRange): Promise<DetailedStageStats[]> {
	const { startDate, endDate } = dateRange;

	// Get aggregated stats
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const statsResult = await (db as any)
		.select({
			stage: stageTelemetry.stage,
			total: count(),
			success: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'success' THEN 1 END`),
			averageDurationMs: sql<number>`COALESCE(AVG(${stageTelemetry.durationMs}), 0)`,
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(stageTelemetry.stage)
		.orderBy(desc(count()));

	// Get sample metadata for each stage (recent 3 entries per stage)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const stages = statsResult.map((row: any) => String(row.stage));
	const detailedStats: DetailedStageStats[] = [];

	for (const stage of stages) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		const sampleMetadata = await (db as any)
			.select({
				metadata: stageTelemetry.metadata,
			})
			.from(stageTelemetry)
			.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
			.innerJoin(chat, eq(chatMessage.chatId, chat.id))
			.where(
				and(
					eq(chat.userId, userId),
					eq(stageTelemetry.stage, stage),
					gte(chatMessage.createdAt, startDate),
					lte(chatMessage.createdAt, endDate),
				),
			)
			.orderBy(desc(stageTelemetry.createdAt))
			.limit(3);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		const statRow = statsResult.find((row: any) => String(row.stage) === stage) as any;
		const total = Number(statRow.total);
		const success = Number(statRow.success);

		detailedStats.push({
			stage: String(stage),
			total,
			success,
			failure: total - success,
			successRate: total > 0 ? success / total : 1,
			averageDurationMs: Math.round(Number(statRow.averageDurationMs)),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
			sampleMetadata: sampleMetadata.map((row: any) => row.metadata),
		});
	}

	return detailedStats;
}

/**
 * Error rate metrics for dashboard
 */
export interface ErrorRateMetrics {
	totalErrors: number;
	criticalErrors: number;
	highErrors: number;
	mediumErrors: number;
	lowErrors: number;
	errorsByStage: Array<{
		stage: string;
		count: number;
		errorRate: number;
	}>;
	recentErrors: Array<{
		id: string;
		stage: string;
		errorType: string;
		errorMessage: string;
		severity: string;
		createdAt: Date;
	}>;
}

/**
 * Get error rate metrics for dashboard
 */
export async function getErrorMetrics(userId: string, dateRange: DateRange): Promise<ErrorRateMetrics> {
	const { startDate, endDate } = dateRange;

	// Count errors by severity
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const severityCounts = await (db as any)
		.select({
			severity: errors.severity,
			count: count(),
		})
		.from(errors)
		.innerJoin(chatMessage, eq(errors.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(errors.severity);

	// Count errors by stage
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const stageCounts = await (db as any)
		.select({
			stage: errors.stage,
			errors: count(),
		})
		.from(errors)
		.innerJoin(chatMessage, eq(errors.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(errors.stage);

	// Get total message count per stage for error rate calculation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const stageTotals = await (db as any)
		.select({
			stage: stageTelemetry.stage,
			total: count(),
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(stageTelemetry.stage);

	// Get recent errors
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const recentErrors = await (db as any)
		.select({
			id: errors.id,
			stage: errors.stage,
			errorType: errors.errorType,
			errorMessage: errors.errorMessage,
			severity: errors.severity,
			createdAt: errors.createdAt,
		})
		.from(errors)
		.innerJoin(chatMessage, eq(errors.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.orderBy(desc(errors.createdAt))
		.limit(10);

	// Aggregate severity counts
	const counts = {
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
		total: 0,
	};

	for (const row of severityCounts) {
		const severity = String(row.severity) as ErrorSeverity;
		const count = Number(row.count);
		counts[severity] = count;
		counts.total += count;
	}

	// Calculate error rates by stage
	const stageMap = new Map<string, number>();
	for (const row of stageTotals) {
		stageMap.set(String(row.stage), Number(row.total));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const errorsByStage = stageCounts.map((row: any) => {
		const stage = String(row.stage);
		const total = stageMap.get(stage) || 0;
		return {
			stage,
			count: Number(row.errors),
			errorRate: total > 0 ? Number(row.errors) / total : 0,
		};
	});

	return {
		totalErrors: counts.total,
		criticalErrors: counts.critical,
		highErrors: counts.high,
		mediumErrors: counts.medium,
		lowErrors: counts.low,
		errorsByStage,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		recentErrors: recentErrors.map((row: any) => ({
			id: String(row.id),
			stage: String(row.stage),
			errorType: String(row.errorType),
			errorMessage: String(row.errorMessage),
			severity: String(row.severity),
			createdAt: row.createdAt,
		})),
	};
}

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
