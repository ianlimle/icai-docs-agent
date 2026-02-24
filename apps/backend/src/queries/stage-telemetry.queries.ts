import { and, asc, eq } from 'drizzle-orm';

import { db } from '../db/db';
import { chat, chatMessage, stageTelemetry } from '../db/pg-schema';
import { StageTelemetry } from '../types/stage-telemetry';

/**
 * Fetch all stage telemetry for a message
 *
 * @param messageId - The message ID to fetch stages for
 * @returns Array of stage telemetry records
 */
export async function getMessageStages(messageId: string): Promise<StageTelemetry[]> {
	const stages = await db
		.select()
		.from(stageTelemetry)
		.where(eq(stageTelemetry.messageId, messageId))
		.orderBy(asc(stageTelemetry.createdAt));

	return stages;
}

/**
 * Fetch stage telemetry for multiple messages
 *
 * @param messageIds - Array of message IDs
 * @returns Map of message ID to array of stage telemetry
 */
export async function getMessagesStages(messageIds: string[]): Promise<Map<string, StageTelemetry[]>> {
	if (messageIds.length === 0) {
		return new Map();
	}

	const result = new Map<string, StageTelemetry[]>();

	// Fetch all stages and group in memory
	// This is acceptable for reasonable message counts
	const allStages = await db.select().from(stageTelemetry);

	for (const messageId of messageIds) {
		const messageStages = allStages.filter((s) => s.messageId === messageId);
		if (messageStages.length > 0) {
			result.set(messageId, messageStages);
		}
	}

	return result;
}

/**
 * Get message with telemetry data
 *
 * @param messageId - The message ID
 * @returns Message with telemetry or null
 */
export async function getMessageWithTelemetry(messageId: string) {
	const messages = await db.select().from(chatMessage).where(eq(chatMessage.id, messageId)).limit(1);

	if (messages.length === 0) {
		return null;
	}

	const message = messages[0];
	const stages = await getMessageStages(messageId);

	return {
		...message,
		stages,
		telemetry: {
			ttftMs: message.ttftMs,
			totalLatencyMs: message.totalLatencyMs,
			estimatedCost: message.estimatedCost,
		},
	};
}

/**
 * Get failed stages for a message
 *
 * @param messageId - The message ID
 * @returns Array of failed stage records
 */
export async function getFailedStages(messageId: string): Promise<StageTelemetry[]> {
	return await db
		.select()
		.from(stageTelemetry)
		.where(and(eq(stageTelemetry.messageId, messageId), eq(stageTelemetry.status, 'failure')))
		.orderBy(asc(stageTelemetry.createdAt));
}

/**
 * Delete all stage telemetry for a message
 *
 * @param messageId - The message ID
 */
export async function deleteMessageStages(messageId: string): Promise<void> {
	await db.delete(stageTelemetry).where(eq(stageTelemetry.messageId, messageId));
}

/**
 * Get stage statistics across all messages
 *
 * @param stageType - Optional stage type to filter by
 * @returns Aggregated statistics
 */
export async function getStageStatistics(stageType?: string) {
	// This would be enhanced with aggregation queries later
	// For now, return basic implementation
	const allStages = await db.select().from(stageTelemetry);

	const filtered = stageType ? allStages.filter((s) => s.stage === stageType) : allStages;

	const successCount = filtered.filter((s) => s.status === 'success').length;
	const failureCount = filtered.filter((s) => s.status === 'failure').length;
	const avgDuration =
		filtered.filter((s) => s.durationMs !== null).reduce((sum, s) => sum + (s.durationMs || 0), 0) /
			filtered.length || 0;

	return {
		total: filtered.length,
		success: successCount,
		failure: failureCount,
		successRate: successCount / filtered.length || 0,
		avgDurationMs: Math.round(avgDuration),
	};
}

/**
 * Get chat by message ID
 *
 * @param messageId - The message ID
 * @returns Chat or null
 */
export async function getChatByMessageId(messageId: string) {
	const result = await db
		.select()
		.from(chatMessage)
		.innerJoin(chat, eq(chatMessage.chatId, chat.id))
		.where(eq(chatMessage.id, messageId))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	return result[0].chat;
}
