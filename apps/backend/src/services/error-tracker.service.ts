import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '../db/db';
import { errors } from '../db/pg-schema';
import type { StageType } from '../types/stage-telemetry';
import { posthog, PostHogEvent } from './posthog.service';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorType = 'timeout' | 'rate_limit' | 'validation' | 'execution' | 'unknown';

interface ErrorTrackingOptions {
	messageId: string;
	stage: StageType;
	errorType: ErrorType;
	errorMessage: string;
	severity: ErrorSeverity;
	metadata?: Record<string, unknown>;
}

/**
 * Error tracking service for monitoring and alerting
 * Logs errors to database, sends to PostHog, and optionally triggers alerts
 */
class ErrorTracker {
	/**
	 * Track an error event
	 */
	async trackError(options: ErrorTrackingOptions): Promise<void> {
		const { messageId, stage, errorType, errorMessage, severity, metadata = {} } = options;

		// Determine severity based on error type if not provided
		const finalSeverity = severity || this.getDefaultSeverity(errorType);

		// Log to database
		await db.insert(errors).values({
			messageId,
			stage,
			errorType,
			errorMessage,
			severity: finalSeverity,
			metadata,
		});

		// Send to PostHog for analytics
		this.sendToPostHog({
			stage,
			errorType,
			errorMessage,
			severity: finalSeverity,
			metadata,
		});

		// Check if we need to trigger alerts for high/critical severity
		if (finalSeverity === 'high' || finalSeverity === 'critical') {
			await this.triggerAlert(options);
		}
	}

	/**
	 * Track a stage failure from stage telemetry
	 * Called automatically by StageTracker
	 */
	async trackStageFailure(
		messageId: string,
		stage: StageType,
		errorMessage: string,
		metadata?: Record<string, unknown>,
	): Promise<void> {
		const errorType = this.classifyError(errorMessage);
		const severity = this.estimateSeverity(errorType, errorMessage);

		await this.trackError({
			messageId,
			stage,
			errorType,
			errorMessage,
			severity,
			metadata,
		});
	}

	/**
	 * Classify error based on message content
	 */
	private classifyError(errorMessage: string): ErrorType {
		const lowerMessage = errorMessage.toLowerCase();

		if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
			return 'timeout';
		}
		if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
			return 'rate_limit';
		}
		if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
			return 'validation';
		}
		if (lowerMessage.includes('execution') || lowerMessage.includes('failed')) {
			return 'execution';
		}

		return 'unknown';
	}

	/**
	 * Estimate severity based on error type and message
	 */
	private estimateSeverity(errorType: ErrorType, errorMessage: string): ErrorSeverity {
		// Critical errors
		if (errorMessage.toLowerCase().includes('critical') || errorMessage.toLowerCase().includes('fatal')) {
			return 'critical';
		}

		// High severity errors
		if (errorType === 'rate_limit' || errorType === 'timeout') {
			return 'high';
		}

		// Medium severity by default
		return 'medium';
	}

	/**
	 * Get default severity for error type
	 */
	private getDefaultSeverity(errorType: ErrorType): ErrorSeverity {
		switch (errorType) {
			case 'rate_limit':
			case 'timeout':
				return 'high';
			case 'validation':
				return 'low';
			default:
				return 'medium';
		}
	}

	/**
	 * Send error event to PostHog
	 */
	private sendToPostHog(data: {
		stage: string;
		errorType: string;
		errorMessage: string;
		severity: string;
		metadata: Record<string, unknown>;
	}): void {
		try {
			posthog.capture(undefined, PostHogEvent.PipelineError, {
				stage: data.stage,
				error_type: data.errorType,
				error_message: data.errorMessage.substring(0, 200), // Truncate for PostHog
				severity: data.severity,
				...data.metadata,
			});
		} catch (error) {
			// Don't let PostHog errors break the flow
			console.error('Failed to send error to PostHog:', error);
		}
	}

	/**
	 * Trigger alert for high/critical severity errors
	 * TODO: Implement Slack/external alerts
	 */
	private async triggerAlert(options: ErrorTrackingOptions): Promise<void> {
		// Future: Send to Slack webhook
		// Future: Send email for critical errors
		// For now, just log
		console.error('[ERROR ALERT]', {
			severity: options.severity,
			stage: options.stage,
			errorType: options.errorType,
			errorMessage: options.errorMessage,
		});
	}

	/**
	 * Get error rate by stage for a time period
	 */
	async getErrorRateByStage(stage: StageType, hours = 24): Promise<number> {
		const since = new Date(Date.now() - hours * 60 * 60 * 1000);

		const result = await db
			.select({
				total: sql<number>`COUNT(*)`,
				errors: sql<number>`SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END)`,
			})
			.from(errors)
			.where(and(eq(errors.stage, stage), gte(errors.createdAt, since)));

		if (!result[0] || result[0].total === 0) {
			return 0;
		}

		return result[0].errors / result[0].total;
	}

	/**
	 * Mark error as resolved
	 */
	async markAsResolved(errorId: string): Promise<void> {
		await db.update(errors).set({ resolvedAt: new Date() }).where(eq(errors.id, errorId));
	}
}

// Singleton instance
export const errorTracker = new ErrorTracker();
