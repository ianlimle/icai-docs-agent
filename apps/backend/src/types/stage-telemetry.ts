/**
 * Pipeline stages for observability tracking
 *
 * These stages represent the key steps in the agent workflow.
 * Failures cascade - if tool routing is wrong, everything downstream fails.
 */
export const STAGE_TYPES = [
	'tool_routing',
	'query_construction',
	'tool_execution',
	'answer_generation',
	'citation',
] as const;

export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_STATUS = ['success', 'failure'] as const;

export type StageStatus = (typeof STAGE_STATUS)[number];

/**
 * Stage metadata - additional context captured during stage execution
 */
export interface StageMetadata {
	toolName?: string;
	input?: Record<string, unknown>;
	outputSize?: number;
	retrievedCount?: number;
	modelId?: string;
	providerId?: string;
	[key: string]: unknown;
}

/**
 * Stage telemetry data stored in database
 */
export interface StageTelemetry {
	id: string;
	messageId: string;
	stage: StageType;
	status: StageStatus;
	durationMs: number | null;
	errorMessage: string | null;
	metadata: StageMetadata | null;
	createdAt: Date;
}

/**
 * Input for creating stage telemetry
 */
export interface NewStageTelemetry {
	id?: string;
	messageId: string;
	stage: StageType;
	status: StageStatus;
	durationMs?: number | null;
	errorMessage?: string | null;
	metadata?: StageMetadata | null;
	createdAt?: Date;
}

/**
 * Chat message telemetry fields
 */
export interface ChatMessageTelemetry {
	ttftMs: number | null; // Time to first token in milliseconds
	totalLatencyMs: number | null; // End-to-end latency in milliseconds
	estimatedCost: number | null; // Estimated cost in micro-units (cost * 1,000,000)
}
