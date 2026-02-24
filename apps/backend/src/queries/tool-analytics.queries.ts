import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '../db/db';
import { chat, chatMessage, stageTelemetry } from '../db/pg-schema';
import { DateRange } from './analytics.queries';

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
	toolName: string;
	totalExecutions: number;
	successfulExecutions: number;
	failedExecutions: number;
	successRate: number;
	averageDurationMs: number;
	totalOutputSize: number;
	averageOutputSize: number;
	totalRetrievedCount: number;
	errorRate: number;
}

/**
 * Get tool usage statistics for a date range
 */
export async function getToolUsageStats(userId: string, dateRange: DateRange): Promise<ToolUsageStats[]> {
	const { startDate, endDate } = dateRange;

	// Get tool execution stats from stage telemetry
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			toolName: sql<string>`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`,
			total: count(),
			success: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'success' THEN 1 END`),
			failed: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'failure' THEN 1 END`),
			averageDurationMs: sql<number>`COALESCE(AVG(${stageTelemetry.durationMs}), 0)`,
			totalOutputSize: sql<number>`COALESCE(SUM((${stageTelemetry.metadata}->>'outputSize')::int), 0)`,
			totalRetrievedCount: sql<number>`COALESCE(SUM((${stageTelemetry.metadata}->>'retrievedCount')::int), 0)`,
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(
				eq(chat.userId, userId),
				eq(stageTelemetry.stage, 'tool_execution'),
				gte(chatMessage.createdAt, startDate),
				lte(chatMessage.createdAt, endDate),
			),
		)
		.groupBy(sql`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`)
		.orderBy(desc(count()));

	return result.map(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
		(row: any) => {
			const total = Number(row.total);
			const success = Number(row.success);
			const failed = Number(row.failed);

			return {
				toolName: String(row.toolName),
				totalExecutions: total,
				successfulExecutions: success,
				failedExecutions: failed,
				successRate: total > 0 ? success / total : 1,
				averageDurationMs: Math.round(Number(row.averageDurationMs)),
				totalOutputSize: Number(row.totalOutputSize),
				averageOutputSize: total > 0 ? Number(row.totalOutputSize) / total : 0,
				totalRetrievedCount: Number(row.totalRetrievedCount),
				errorRate: total > 0 ? failed / total : 0,
			};
		},
	);
}

/**
 * Get tool performance trends over time
 */
export interface ToolPerformanceTrend {
	date: string; // YYYY-MM-DD
	toolName: string;
	executions: number;
	averageDurationMs: number;
	errorRate: number;
}

/**
 * Get daily tool performance trends
 */
export async function getToolPerformanceTrends(
	userId: string,
	dateRange: DateRange,
	topN = 5,
): Promise<ToolPerformanceTrend[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			date: sql<string>`DATE(${chatMessage.createdAt})`,
			toolName: sql<string>`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`,
			executions: count(),
			averageDurationMs: sql<number>`COALESCE(AVG(${stageTelemetry.durationMs}), 0)`,
			errors: count(sql<number>`CASE WHEN ${stageTelemetry.status} = 'failure' THEN 1 END`),
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(
				eq(chat.userId, userId),
				eq(stageTelemetry.stage, 'tool_execution'),
				gte(chatMessage.createdAt, startDate),
				lte(chatMessage.createdAt, endDate),
			),
		)
		.groupBy(sql`DATE(${chatMessage.createdAt})`, sql`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`)
		.orderBy(sql`DATE(${chatMessage.createdAt})`, desc(count()))
		.limit(500); // Enough data for trends

	// Get top N tools by total executions
	const toolTotals = new Map<string, number>();
	for (const row of result) {
		const tool = String(row.toolName);
		toolTotals.set(tool, (toolTotals.get(tool) || 0) + Number(row.executions));
	}
	const topTools = Array.from(toolTotals.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, topN)
		.map((entry) => entry[0]);

	// Filter and format results
	return (
		result
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
			.filter((row: any) => topTools.includes(String(row.toolName)))
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
			.map((row: any) => {
				const executions = Number(row.executions);
				const errors = Number(row.errors);

				return {
					date: String(row.date),
					toolName: String(row.toolName),
					executions,
					averageDurationMs: Math.round(Number(row.averageDurationMs)),
					errorRate: executions > 0 ? errors / executions : 0,
				};
			})
	);
}

/**
 * Get tool error breakdown
 */
export interface ToolErrorBreakdown {
	toolName: string;
	errorCount: number;
	mostCommonErrors: Array<{
		errorMessage: string;
		count: number;
	}>;
}

/**
 * Get error breakdown by tool
 */
export async function getToolErrorBreakdown(userId: string, dateRange: DateRange): Promise<ToolErrorBreakdown[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const errorResults = await (db as any)
		.select({
			toolName: sql<string>`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`,
			errorMessage: stageTelemetry.errorMessage,
			count: count(),
		})
		.from(stageTelemetry)
		.innerJoin(chatMessage, eq(stageTelemetry.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(
				eq(chat.userId, userId),
				eq(stageTelemetry.stage, 'tool_execution'),
				eq(stageTelemetry.status, 'failure'),
				gte(chatMessage.createdAt, startDate),
				lte(chatMessage.createdAt, endDate),
				sql`${stageTelemetry.errorMessage} IS NOT NULL`,
			),
		)
		.groupBy(sql`COALESCE(${stageTelemetry.metadata}->>'toolName', 'unknown')`, stageTelemetry.errorMessage)
		.orderBy(desc(count()));

	// Group by tool name
	const toolMap = new Map<string, ToolErrorBreakdown>();

	for (const row of errorResults) {
		const toolName = String(row.toolName);
		const errorMessage = String(row.errorMessage);
		const count = Number(row.count);

		if (!toolMap.has(toolName)) {
			toolMap.set(toolName, {
				toolName,
				errorCount: 0,
				mostCommonErrors: [],
			});
		}

		const breakdown = toolMap.get(toolName)!;
		breakdown.errorCount += count;
		breakdown.mostCommonErrors.push({ errorMessage, count });
	}

	// Sort errors by count within each tool
	for (const breakdown of toolMap.values()) {
		breakdown.mostCommonErrors.sort((a, b) => b.count - a.count);
		breakdown.mostCommonErrors = breakdown.mostCommonErrors.slice(0, 5); // Top 5 errors per tool
	}

	return Array.from(toolMap.values()).sort((a, b) => b.errorCount - a.errorCount);
}
