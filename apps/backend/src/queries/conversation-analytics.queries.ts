import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { db } from '../db/db';
import { chat, chatMessage, messageFeedback } from '../db/pg-schema';
import { DateRange } from './analytics.queries';

/**
 * Conversation-level metrics
 */
export interface ConversationMetrics {
	totalConversations: number;
	averageMessagesPerConversation: number;
	averageCostPerConversation: number;
	totalCost: number;
	completedConversations: number;
	completionRate: number;
	averageDurationSeconds: number;
	conversationsWithFeedback: number;
	positiveFeedbackRate: number;
}

/**
 * Individual conversation statistics
 */
export interface ConversationStats {
	chatId: string;
	chatTitle: string | null;
	messageCount: number;
	totalCost: number;
	averageTtftMs: number;
	averageLatencyMs: number;
	startedAt: Date;
	lastMessageAt: Date;
	durationSeconds: number;
	hasFeedback: boolean;
	positiveFeedbackCount: number;
	totalFeedbackCount: number;
}

/**
 * Conversation trends over time
 */
export interface ConversationTrend {
	date: string; // YYYY-MM-DD
	conversationCount: number;
	totalMessages: number;
	totalCost: number;
	averageCostPerConversation: number;
	averageMessagesPerConversation: number;
}

/**
 * Get aggregated conversation metrics for a date range
 */
export async function getConversationMetrics(userId: string, dateRange: DateRange): Promise<ConversationMetrics> {
	const { startDate, endDate } = dateRange;

	// Get basic conversation stats
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const conversationStats = await (db as any)
		.select({
			totalConversations: count(chat.id),
		})
		.from(chat)
		.where(and(eq(chat.userId, userId), gte(chat.createdAt, startDate), lte(chat.createdAt, endDate)));

	// Get message stats per conversation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const messageStats = await (db as any)
		.select({
			messageCount: count(chatMessage.id),
			totalCost: sql<number>`COALESCE(SUM((${chatMessage.estimatedCost})::float / 1000000.0), 0)`,
		})
		.from(chatMessage)
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(chatMessage.chatId);

	// Calculate average messages per conversation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const totalMessages = messageStats.reduce((sum: number, stat: any) => sum + Number(stat.messageCount), 0);
	const avgMessagesPerConversation =
		conversationStats[0].totalConversations > 0 ? totalMessages / conversationStats[0].totalConversations : 0;

	// Calculate average cost per conversation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const totalCost = messageStats.reduce((sum: number, stat: any) => sum + Number(stat.totalCost), 0);
	const avgCostPerConversation =
		conversationStats[0].totalConversations > 0 ? totalCost / conversationStats[0].totalConversations : 0;

	// Get completed conversations (those with at least 2 messages - user question + assistant response)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const completedStats = await (db as any)
		.select({
			chatId: chatMessage.chatId,
			messageCount: count(chatMessage.id),
		})
		.from(chatMessage)
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chatMessage.createdAt, startDate), lte(chatMessage.createdAt, endDate)))
		.groupBy(chatMessage.chatId);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const completedConversations = completedStats.filter((stat: any) => Number(stat.messageCount) >= 2).length;
	const completionRate =
		conversationStats[0].totalConversations > 0
			? completedConversations / conversationStats[0].totalConversations
			: 0;

	// Get average conversation duration
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const durationStats = await (db as any)
		.select({
			chatId: chat.id,
			startTime: chat.createdAt,
			lastMessageTime: sql<Date>`MAX(${chatMessage.createdAt})`,
		})
		.from(chat)
		.innerJoin(chatMessage, eq(chat.id, chatMessage.chatId))
		.where(and(eq(chat.userId, userId), gte(chat.createdAt, startDate), lte(chat.createdAt, endDate)))
		.groupBy(chat.id);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const totalDuration = durationStats.reduce((sum: number, stat: any) => {
		const start = new Date(stat.startTime).getTime();
		const end = new Date(stat.lastMessageTime).getTime();
		return sum + (end - start) / 1000;
	}, 0);

	const avgDurationSeconds =
		conversationStats[0].totalConversations > 0 ? totalDuration / conversationStats[0].totalConversations : 0;

	// Get feedback stats
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const feedbackStats = await (db as any)
		.select({
			conversationCount: count(sql<string>`DISTINCT ${chatMessage.chatId}`),
			positiveCount: count(sql<string>`CASE WHEN ${messageFeedback.vote} = 'up' THEN 1 END`),
			totalCount: count(),
		})
		.from(messageFeedback)
		.innerJoin(chatMessage, eq(messageFeedback.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(
			and(
				eq(chat.userId, userId),
				gte(messageFeedback.createdAt, startDate),
				lte(messageFeedback.createdAt, endDate),
			),
		);

	const positiveFeedbackRate =
		feedbackStats[0]?.totalCount > 0 ? feedbackStats[0].positiveCount / feedbackStats[0].totalCount : 0;

	return {
		totalConversations: conversationStats[0].totalConversations,
		averageMessagesPerConversation: Math.round(avgMessagesPerConversation * 10) / 10,
		averageCostPerConversation: Math.round(avgCostPerConversation * 100) / 100,
		totalCost: Math.round(totalCost * 100) / 100,
		completedConversations,
		completionRate: Math.round(completionRate * 1000) / 1000,
		averageDurationSeconds: Math.round(avgDurationSeconds),
		conversationsWithFeedback: feedbackStats[0]?.conversationCount || 0,
		positiveFeedbackRate: Math.round(positiveFeedbackRate * 1000) / 1000,
	};
}

/**
 * Get individual conversation statistics
 */
export async function getConversationStats(
	userId: string,
	dateRange: DateRange,
	limit = 50,
): Promise<ConversationStats[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			chatId: chat.id,
			chatTitle: chat.title,
			messageCount: count(chatMessage.id),
			totalCost: sql<number>`COALESCE(SUM((${chatMessage.estimatedCost})::float / 1000000.0), 0)`,
			averageTtftMs: sql<number>`COALESCE(AVG(${chatMessage.ttftMs}), 0)`,
			averageLatencyMs: sql<number>`COALESCE(AVG(${chatMessage.totalLatencyMs}), 0)`,
			startedAt: chat.createdAt,
			lastMessageAt: sql<Date>`MAX(${chatMessage.createdAt})`,
		})
		.from(chat)
		.innerJoin(chatMessage, eq(chat.id, chatMessage.chatId))
		.where(and(eq(chat.userId, userId), gte(chat.createdAt, startDate), lte(chat.createdAt, endDate)))
		.groupBy(chat.id)
		.orderBy(desc(sql`MAX(${chatMessage.createdAt})`))
		.limit(limit);

	// Get feedback ratings per conversation
	const feedbackMap = new Map<string, { positiveCount: number; totalCount: number }>();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const feedbackData = await (db as any)
		.select({
			chatId: chatMessage.chatId,
			vote: messageFeedback.vote,
		})
		.from(messageFeedback)
		.innerJoin(chatMessage, eq(messageFeedback.messageId, chatMessage.id))
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(and(eq(chat.userId, userId), gte(chat.createdAt, startDate), lte(chat.createdAt, endDate)));

	for (const row of feedbackData) {
		const chatId = String(row.chatId);
		if (!feedbackMap.has(chatId)) {
			feedbackMap.set(chatId, { positiveCount: 0, totalCount: 0 });
		}
		const entry = feedbackMap.get(chatId)!;
		entry.totalCount += 1;
		if (row.vote === 'up') {
			entry.positiveCount += 1;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	return result.map((row: any) => {
		const startedAt = new Date(row.startedAt);
		const lastMessageAt = new Date(row.lastMessageAt);
		const durationSeconds = (lastMessageAt.getTime() - startedAt.getTime()) / 1000;

		const feedback = feedbackMap.get(String(row.chatId));

		return {
			chatId: String(row.chatId),
			chatTitle: row.chatTitle,
			messageCount: Number(row.messageCount),
			totalCost: Math.round(Number(row.totalCost) * 100) / 100,
			averageTtftMs: Math.round(Number(row.averageTtftMs)),
			averageLatencyMs: Math.round(Number(row.averageLatencyMs)),
			startedAt,
			lastMessageAt,
			durationSeconds: Math.round(durationSeconds),
			hasFeedback: feedback ? feedback.totalCount > 0 : false,
			positiveFeedbackCount: feedback ? feedback.positiveCount : 0,
			totalFeedbackCount: feedback ? feedback.totalCount : 0,
		};
	});
}

/**
 * Get daily conversation trends
 */
export async function getConversationTrends(userId: string, dateRange: DateRange): Promise<ConversationTrend[]> {
	const { startDate, endDate } = dateRange;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	const result = await (db as any)
		.select({
			date: sql<string>`DATE(${chat.createdAt})`,
			conversationCount: count(sql<string>`DISTINCT ${chat.id}`),
			totalMessages: count(chatMessage.id),
			totalCost: sql<number>`COALESCE(SUM((${chatMessage.estimatedCost})::float / 1000000.0), 0)`,
		})
		.from(chat)
		.innerJoin(chatMessage, eq(chat.id, chatMessage.chatId))
		.where(and(eq(chat.userId, userId), gte(chat.createdAt, startDate), lte(chat.createdAt, endDate)))
		.groupBy(sql`DATE(${chat.createdAt})`)
		.orderBy(sql`DATE(${chat.createdAt})`);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dialect-agnostic queries
	return result.map((row: any) => ({
		date: String(row.date),
		conversationCount: Number(row.conversationCount),
		totalMessages: Number(row.totalMessages),
		totalCost: Math.round(Number(row.totalCost) * 100) / 100,
		averageCostPerConversation:
			Number(row.conversationCount) > 0
				? Math.round((Number(row.totalCost) / Number(row.conversationCount)) * 100) / 100
				: 0,
		averageMessagesPerConversation:
			Number(row.conversationCount) > 0
				? Math.round((Number(row.totalMessages) / Number(row.conversationCount)) * 10) / 10
				: 0,
	}));
}
