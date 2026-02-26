import { type ProviderMetadata } from 'ai';
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';

import { AgentSettings } from '../types/agent-settings';
import { StopReason, ToolState, UIMessagePartType } from '../types/chat';
import { LlmProvider } from '../types/llm';
import { ORG_ROLES } from '../types/organization';
import { USER_ROLES } from '../types/project';
import { STAGE_STATUS, STAGE_TYPES, StageMetadata } from '../types/stage-telemetry';
import { MEMORY_CATEGORIES } from '../utils/memory';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	requiresPasswordReset: boolean('requires_password_reset').default(false).notNull(),
	memoryEnabled: boolean('memory_enabled').default(true).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
	},
	(table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const organization = pgTable('organization', {
	id: text('id')
		.$defaultFn(() => crypto.randomUUID())
		.primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	// SSO config
	googleClientId: text('google_client_id'),
	googleClientSecret: text('google_client_secret'),
	googleAuthDomains: text('google_auth_domains'), // comma-separated list
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const orgMember = pgTable(
	'org_member',
	{
		orgId: text('org_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ORG_ROLES }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.orgId, t.userId] }), index('org_member_userId_idx').on(t.userId)],
);

export const project = pgTable(
	'project',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		orgId: text('org_id').references(() => organization.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type', { enum: ['local'] }).notNull(),
		path: text('path'),
		slackBotToken: text('slack_bot_token'),
		slackSigningSecret: text('slack_signing_secret'),
		agentSettings: jsonb('agent_settings').$type<AgentSettings>(),
		enabledMcpTools: jsonb('enabled_tools').$type<string[]>().notNull().default([]),
		knownMcpServers: jsonb('known_mcp_servers').$type<string[]>().notNull().default([]),
		workflowInitCompleted: boolean('workflow_init_completed').default(false).notNull(),
		workflowInitCompletedAt: timestamp('workflow_init_completed_at'),
		workflowDebugCompleted: boolean('workflow_debug_completed').default(false).notNull(),
		workflowDebugCompletedAt: timestamp('workflow_debug_completed_at'),
		workflowSyncCompleted: boolean('workflow_sync_completed').default(false).notNull(),
		workflowSyncCompletedAt: timestamp('workflow_sync_completed_at'),
		workflowLastError: text('workflow_last_error'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		check(
			'local_project_path_required',
			sql`CASE WHEN ${t.type} = 'local' THEN ${t.path} IS NOT NULL ELSE TRUE END`,
		),
		index('project_orgId_idx').on(t.orgId),
	],
);

export const chat = pgTable(
	'chat',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('New Conversation'),
		slackThreadId: text('slack_thread_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index('chat_userId_idx').on(table.userId),
		index('chat_projectId_idx').on(table.projectId),
		index('chat_slack_thread_idx').on(table.slackThreadId),
	],
);

export const chatMessage = pgTable(
	'chat_message',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		chatId: text('chat_id')
			.notNull()
			.references(() => chat.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
		stopReason: text('stop_reason').$type<StopReason>(),
		errorMessage: text('error_message'),
		llmProvider: text('llm_provider').$type<LlmProvider>(),
		llmModelId: text('llm_model_id'),
		supersededAt: timestamp('superseded_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),

		// Token usage columns
		inputTotalTokens: integer('input_total_tokens'),
		inputNoCacheTokens: integer('input_no_cache_tokens'),
		inputCacheReadTokens: integer('input_cache_read_tokens'),
		inputCacheWriteTokens: integer('input_cache_write_tokens'),
		outputTotalTokens: integer('output_total_tokens'),
		outputTextTokens: integer('output_text_tokens'),
		outputReasoningTokens: integer('output_reasoning_tokens'),
		totalTokens: integer('total_tokens'),

		// Telemetry columns
		ttftMs: integer('ttft_ms'), // Time to first token in milliseconds
		totalLatencyMs: integer('total_latency_ms'), // End-to-end latency in milliseconds
		estimatedCost: integer('estimated_cost'), // Estimated cost in micro-units (cost * 1,000,000)
	},
	(table) => [
		index('chat_message_chatId_idx').on(table.chatId),
		index('chat_message_createdAt_idx').on(table.createdAt),
	],
);

export const stageTelemetry = pgTable(
	'stage_telemetry',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		messageId: text('message_id')
			.notNull()
			.references(() => chatMessage.id, { onDelete: 'cascade' }),
		stage: text('stage', { enum: STAGE_TYPES }).notNull(),
		status: text('status', { enum: STAGE_STATUS }).notNull(),
		durationMs: integer('duration_ms'),
		errorMessage: text('error_message'),
		metadata: jsonb('metadata').$type<StageMetadata>(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('stage_telemetry_message_id_idx').on(table.messageId),
		index('stage_telemetry_stage_idx').on(table.stage),
	],
);

export const messagePart = pgTable(
	'message_part',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		messageId: text('message_id')
			.references(() => chatMessage.id, { onDelete: 'cascade' })
			.notNull(),
		order: integer('order').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		type: text('type').$type<UIMessagePartType>().notNull(),

		// text columns
		text: text('text'),
		reasoningText: text('reasoning_text'),

		// tool call columns
		toolCallId: text('tool_call_id'),
		toolName: text('tool_name'),
		toolState: text('tool_state').$type<ToolState>(),
		toolErrorText: text('tool_error_text'),
		toolInput: jsonb('tool_input').$type<unknown>(),
		toolRawInput: jsonb('tool_raw_input').$type<unknown>(),
		toolOutput: jsonb('tool_output').$type<unknown>(),

		// tool approval columns
		toolApprovalId: text('tool_approval_id'),
		toolApprovalApproved: boolean('tool_approval_approved'),
		toolApprovalReason: text('tool_approval_reason'),

		// provider metadata columns
		toolProviderMetadata: jsonb('tool_provider_metadata').$type<ProviderMetadata>(),
		providerMetadata: jsonb('provider_metadata').$type<ProviderMetadata>(),
	},
	(t) => [
		index('parts_message_id_idx').on(t.messageId),
		index('parts_message_id_order_idx').on(t.messageId, t.order),
		check(
			'text_required_if_type_is_text',
			sql`CASE WHEN ${t.type} = 'text' THEN ${t.text} IS NOT NULL ELSE TRUE END`,
		),
		check(
			'reasoning_text_required_if_type_is_reasoning',
			sql`CASE WHEN ${t.type} = 'reasoning' THEN ${t.reasoningText} IS NOT NULL ELSE TRUE END`,
		),
		check(
			'tool_call_fields_required',
			sql`CASE WHEN ${t.type} LIKE 'tool-%' THEN ${t.toolCallId} IS NOT NULL AND ${t.toolState} IS NOT NULL ELSE TRUE END`,
		),
	],
);

export const messageFeedback = pgTable('message_feedback', {
	messageId: text('message_id')
		.primaryKey()
		.references(() => chatMessage.id, { onDelete: 'cascade' }),
	vote: text('vote', { enum: ['up', 'down'] }).notNull(),
	explanation: text('explanation'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const projectMember = pgTable(
	'project_member',
	{
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role', { enum: USER_ROLES }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.projectId, t.userId] }), index('project_member_userId_idx').on(t.userId)],
);

export const projectLlmConfig = pgTable(
	'project_llm_config',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		provider: text('provider').$type<LlmProvider>().notNull(),
		apiKey: text('api_key').notNull(),
		enabledModels: jsonb('enabled_models').$type<string[]>().default([]).notNull(),
		baseUrl: text('base_url'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index('project_llm_config_projectId_idx').on(t.projectId),
		unique('project_llm_config_project_provider').on(t.projectId, t.provider),
	],
);

export const projectSavedPrompt = pgTable(
	'project_saved_prompt',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		prompt: text('prompt').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index('project_saved_prompt_projectId_idx').on(t.projectId)],
);

export const memories = pgTable(
	'memories',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		category: text('category', { enum: MEMORY_CATEGORIES }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		chatId: text('chat_id').references(() => chat.id, { onDelete: 'set null' }),
	},
	(t) => [index('memories_userId_idx').on(t.userId), index('memories_chatId_idx').on(t.chatId)],
);

/**
 * Error tracking table for monitoring and alerting
 * Separate from stage_telemetry for easier querying and alerting
 */
export const errors = pgTable(
	'errors',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		messageId: text('message_id')
			.notNull()
			.references(() => chatMessage.id, { onDelete: 'cascade' }),
		stage: text('stage', { enum: STAGE_TYPES }).notNull(),
		errorType: text('error_type').notNull(), // e.g., 'timeout', 'rate_limit', 'validation', 'execution'
		errorMessage: text('error_message').notNull(),
		severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),
		resolvedAt: timestamp('resolved_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [
		index('errors_message_id_idx').on(t.messageId),
		index('errors_stage_idx').on(t.stage),
		index('errors_severity_idx').on(t.severity),
		index('errors_created_at_idx').on(t.createdAt),
		index('errors_error_type_idx').on(t.errorType),
	],
);

/**
 * Guardrails audit logs table
 */
export const auditLogs = pgTable(
	'audit_logs',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		userId: text('user_id').notNull(),
		projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
		timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
		eventType: text('event_type').notNull(),
		violationType: text('violation_type').notNull(),
		severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
		query: text('query').notNull(),
		sanitizedQuery: text('sanitized_query'),
		message: text('message').notNull(),
		details: jsonb('details').$type<Record<string, unknown>>(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(t) => [
		index('audit_logs_user_id_idx').on(t.userId),
		index('audit_logs_project_id_idx').on(t.projectId),
		index('audit_logs_timestamp_idx').on(t.timestamp),
		index('audit_logs_event_type_idx').on(t.eventType),
		index('audit_logs_created_at_idx').on(t.createdAt),
	],
);

/**
 * Guardrails settings table
 */
export const guardrailsSettings = pgTable(
	'guardrails_settings',
	{
		id: text('id')
			.$defaultFn(() => crypto.randomUUID())
			.primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' })
			.unique(),
		settings: jsonb('settings')
			.$type<{
				maxQueryLength: number;
				maxQueryComplexity: number;
				enableRateLimiting: boolean;
				rateLimitConfig: {
					maxRequestsPerMinute: number;
					maxRequestsPerHour: number;
					burstAllowance: number;
				};
				enablePromptInjectionDetection: boolean;
				promptInjectionStrictness: 'low' | 'medium' | 'high';
				enableProfanityFilter: boolean;
				enablePIIDetection: boolean;
				enablePIIRedaction: boolean;
				customPatterns: Array<{
					id: string;
					name: string;
					pattern: string;
					isAllowed: boolean;
					isEnabled: boolean;
					description: string | undefined;
					createdAt: number;
					updatedAt: number;
				}>;
				enableAuditLogging: boolean;
				auditLogRetentionDays: number;
				blockOnError: boolean;
				showErrorToUser: boolean;
			}>()
			.notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [index('guardrails_settings_project_id_idx').on(t.projectId)],
);
