import { z } from 'zod';

import * as stageTelemetryQueries from '../queries/stage-telemetry.queries';
import { protectedProcedure } from './trpc';

export const telemetryRoutes = {
	/**
	 * Get telemetry data for a specific message
	 * Returns message telemetry (TTFT, latency, cost) and stage breakdown
	 */
	getMessageTelemetry: protectedProcedure
		.input(
			z.object({
				messageId: z.string(),
			}),
		)
		.query(async ({ input, ctx }) => {
			const messageWithTelemetry = await stageTelemetryQueries.getMessageWithTelemetry(input.messageId);

			if (!messageWithTelemetry) {
				return null;
			}

			// Check authorization - user must own the chat this message belongs to
			const chat = await stageTelemetryQueries.getChatByMessageId(input.messageId);
			if (!chat || chat.userId !== ctx.user.id) {
				return null;
			}

			// Return formatted telemetry data
			return {
				messageId: input.messageId,
				telemetry: {
					ttftMs: messageWithTelemetry.ttftMs,
					totalLatencyMs: messageWithTelemetry.totalLatencyMs,
					estimatedCost: messageWithTelemetry.estimatedCost
						? messageWithTelemetry.estimatedCost / 1_000_000
						: undefined,
				},
				tokenUsage: messageWithTelemetry.inputTotalTokens
					? {
							inputTotalTokens: messageWithTelemetry.inputTotalTokens,
							inputNoCacheTokens: messageWithTelemetry.inputNoCacheTokens,
							inputCacheReadTokens: messageWithTelemetry.inputCacheReadTokens,
							inputCacheWriteTokens: messageWithTelemetry.inputCacheWriteTokens,
							outputTotalTokens: messageWithTelemetry.outputTotalTokens,
							outputTextTokens: messageWithTelemetry.outputTextTokens,
							outputReasoningTokens: messageWithTelemetry.outputReasoningTokens,
							totalTokens: messageWithTelemetry.totalTokens,
						}
					: undefined,
				stages: messageWithTelemetry.stages.map((stage) => ({
					id: stage.id,
					stage: stage.stage,
					status: stage.status,
					durationMs: stage.durationMs,
					errorMessage: stage.errorMessage,
					metadata: stage.metadata,
					createdAt: stage.createdAt,
				})),
			};
		}),
};
