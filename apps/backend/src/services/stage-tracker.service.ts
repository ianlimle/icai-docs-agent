import { db } from '../db/db';
import { stageTelemetry } from '../db/pg-schema';
import { NewStageTelemetry, StageMetadata, StageStatus, StageType } from '../types/stage-telemetry';
import { errorTracker } from './error-tracker.service';

/**
 * Async local storage for the current stage tracker
 * Uses a simple variable with async context tracking
 */
let currentStageTracker: StageTracker | undefined = undefined;

/**
 * Set the current stage tracker for this async context
 */
export function setCurrentStageTracker(tracker: StageTracker | undefined): void {
	currentStageTracker = tracker;
}

/**
 * Get the current stage tracker
 */
export function getCurrentStageTracker(): StageTracker | undefined {
	return currentStageTracker;
}

/**
 * In-memory tracking for a single stage execution
 */
interface StageExecution {
	stage: StageType;
	status: 'running' | StageStatus;
	startTime: number;
	endTime?: number;
	durationMs?: number;
	errorMessage?: string;
	metadata?: StageMetadata;
}

/**
 * Result of completing a stage
 */
export interface StageResult {
	success: boolean;
	error?: string;
	metadata?: StageMetadata;
}

/**
 * Stage tracker for monitoring agent pipeline stages
 *
 * Tracks execution of pipeline stages (tool routing, query construction, retrieval, etc.)
 * and persists telemetry data to the database.
 *
 * Usage:
 * ```ts
 * const tracker = new StageTracker();
 *
 * // Start a stage
 * tracker.startStage('tool_routing', { toolName: 'grep' });
 *
 * // Complete the stage
 * tracker.completeStage('tool_routing', { success: true });
 *
 * // Persist all stages
 * await tracker.persist(messageId);
 * ```
 */
export class StageTracker {
	private stages: Map<StageType, StageExecution> = new Map();

	/**
	 * Start tracking a stage
	 *
	 * @param stage - The stage type to track
	 * @param metadata - Optional metadata about the stage
	 */
	startStage(stage: StageType, metadata?: StageMetadata): void {
		this.stages.set(stage, {
			stage,
			status: 'running',
			startTime: performance.now(),
			metadata,
		});
	}

	/**
	 * Complete a stage with result
	 *
	 * @param stage - The stage type to complete
	 * @param result - The result of the stage execution
	 */
	completeStage(stage: StageType, result: StageResult): void {
		const execution = this.stages.get(stage);
		if (!execution) {
			console.warn(`[StageTracker] Attempted to complete untracked stage: ${stage}`);
			return;
		}

		if (execution.status !== 'running') {
			console.warn(`[StageTracker] Stage ${stage} is not running, skipping completion`);
			return;
		}

		const endTime = performance.now();
		const durationMs = Math.round(endTime - execution.startTime);

		this.stages.set(stage, {
			...execution,
			status: result.success ? 'success' : 'failure',
			endTime,
			durationMs,
			errorMessage: result.error,
			metadata: result.metadata || execution.metadata,
		});
	}

	/**
	 * Get all tracked stages
	 */
	getStages(): StageExecution[] {
		return Array.from(this.stages.values());
	}

	/**
	 * Get a specific stage by type
	 */
	getStage(stage: StageType): StageExecution | undefined {
		return this.stages.get(stage);
	}

	/**
	 * Persist all tracked stages to the database
	 *
	 * @param messageId - The message ID to associate stages with
	 * @returns Promise that resolves when all stages are persisted
	 */
	async persist(messageId: string): Promise<void> {
		const stages = this.getStages();

		if (stages.length === 0) {
			console.debug('[StageTracker] No stages to persist');
			return;
		}

		try {
			const records: NewStageTelemetry[] = stages
				.filter((s) => s.status !== 'running')
				.map((stage) => ({
					messageId,
					stage: stage.stage,
					status: stage.status as StageStatus,
					durationMs: stage.durationMs ?? null,
					errorMessage: stage.errorMessage ?? null,
					metadata: stage.metadata ?? null,
				}));

			if (records.length > 0) {
				await db.insert(stageTelemetry).values(records);
				console.debug(`[StageTracker] Persisted ${records.length} stages for message ${messageId}`);
			}

			// Track failures in errors table for alerting
			for (const stage of stages) {
				if (stage.status === 'failure' && stage.errorMessage) {
					try {
						await errorTracker.trackStageFailure(
							messageId,
							stage.stage,
							stage.errorMessage,
							stage.metadata ?? undefined,
						);
					} catch (error) {
						// Don't let error tracking break the flow
						console.error('[StageTracker] Failed to track error:', error);
					}
				}
			}

			// Clear persisted stages from memory
			this.stages.clear();
		} catch (error) {
			console.error('[StageTracker] Failed to persist stages:', error);
			// Don't throw - telemetry failures shouldn't break the agent
		}
	}

	/**
	 * Clear all tracked stages without persisting
	 */
	clear(): void {
		this.stages.clear();
	}

	/**
	 * Get summary of all stages
	 */
	getSummary(): Record<
		string,
		{
			status: string;
			durationMs?: number;
			hasError: boolean;
		}
	> {
		const summary: Record<
			string,
			{
				status: string;
				durationMs?: number;
				hasError: boolean;
			}
		> = {};

		for (const [stageType, execution] of this.stages) {
			summary[stageType] = {
				status: execution.status,
				durationMs: execution.durationMs,
				hasError: !!execution.errorMessage,
			};
		}

		return summary;
	}
}

/**
 * Context passed to tools during execution
 */
export interface ToolContext {
	stageTracker?: StageTracker;
	messageId?: string;
	[key: string]: unknown;
}

/**
 * Create a stage tracker with automatic cleanup
 *
 * @returns StageTracker instance
 */
export function createStageTracker(): StageTracker {
	return new StageTracker();
}
