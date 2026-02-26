/**
 * Guardrails queries for settings and audit logs
 */

import { and, desc, eq, gt, lt } from 'drizzle-orm';

import { db } from '../db/db';
// Use the correct schema based on dialect
import dbConfig from '../db/dbConfig';
import { Dialect } from '../db/dbConfig';
// Import tables directly from schema files to avoid export issues
import { auditLogs, guardrailsSettings } from '../db/pg-schema';
import { auditLogs as auditLogsSqlite, guardrailsSettings as guardrailsSettingsSqlite } from '../db/sqlite-schema';
import { DEFAULT_GUARDRAILS_SETTINGS, GuardrailsSettings } from '../types/guardrails';

const auditLogsTable = dbConfig.dialect === Dialect.Postgres ? auditLogs : auditLogsSqlite;
const guardrailsSettingsTable = dbConfig.dialect === Dialect.Postgres ? guardrailsSettings : guardrailsSettingsSqlite;

/**
 * Get guardrails settings for a project
 */
export const getGuardrailsSettings = async (projectId: string): Promise<GuardrailsSettings> => {
	const result = await db
		.select()
		.from(guardrailsSettingsTable)
		.where(eq(guardrailsSettingsTable.projectId, projectId));

	if (result.length === 0) {
		return DEFAULT_GUARDRAILS_SETTINGS;
	}

	return result[0].settings as GuardrailsSettings;
};

/**
 * Update guardrails settings for a project
 */
export const updateGuardrailsSettings = async (projectId: string, settings: GuardrailsSettings): Promise<void> => {
	const existing = await db
		.select()
		.from(guardrailsSettingsTable)
		.where(eq(guardrailsSettingsTable.projectId, projectId));

	if (existing.length === 0) {
		await db.insert(guardrailsSettingsTable).values({
			id: crypto.randomUUID(),
			projectId,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			settings: settings as any,
		});
	} else {
		await db
			.update(guardrailsSettingsTable)
			.set({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				settings: settings as any,
				updatedAt: new Date(),
			})
			.where(eq(guardrailsSettingsTable.projectId, projectId));
	}
};

/**
 * Get audit logs with pagination
 */
export const getAuditLogs = async (opts: {
	projectId?: string;
	userId?: string;
	eventType?: string;
	limit?: number;
	offset?: number;
	startDate?: Date;
	endDate?: Date;
}) => {
	const { projectId, userId, eventType, limit = 50, offset = 0, startDate, endDate } = opts;

	const conditions = [];

	if (projectId) {
		conditions.push(eq(auditLogsTable.projectId, projectId));
	}
	if (userId) {
		conditions.push(eq(auditLogsTable.userId, userId));
	}
	if (eventType) {
		conditions.push(eq(auditLogsTable.eventType, eventType));
	}
	if (startDate) {
		conditions.push(gt(auditLogsTable.timestamp, startDate.getTime()));
	}
	if (endDate) {
		conditions.push(lt(auditLogsTable.timestamp, endDate.getTime()));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const logs = await db
		.select()
		.from(auditLogsTable)
		.where(where)
		.orderBy(desc(auditLogsTable.timestamp))
		.limit(limit)
		.offset(offset);

	return logs;
};

/**
 * Write an audit log entry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createAuditLog = async (log: Omit<any, 'id' | 'createdAt'>): Promise<string> => {
	const id = crypto.randomUUID();

	await db.insert(auditLogsTable).values({
		id,
		createdAt: new Date(),
		...log,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);

	return id;
};

/**
 * Delete old audit logs based on retention policy
 */
export const deleteOldAuditLogs = async (retentionDays: number): Promise<number> => {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	const result = await db
		.delete(auditLogsTable)
		.where(lt(auditLogsTable.createdAt, cutoffDate))
		.returning(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ id: auditLogsTable.id } as any,
		);

	return result.length;
};

/**
 * Get audit log statistics
 */
export const getAuditLogStats = async (opts: { projectId?: string; userId?: string } = {}) => {
	const { projectId, userId } = opts;
	const conditions = [];

	if (projectId) {
		conditions.push(eq(auditLogsTable.projectId, projectId));
	}
	if (userId) {
		conditions.push(eq(auditLogsTable.userId, userId));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const logs = await db.select().from(auditLogsTable).where(where);

	return {
		total: logs.length,
		byEventType: logs.reduce(
			(acc, log) => {
				acc[log.eventType] = (acc[log.eventType] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		),
		bySeverity: logs.reduce(
			(acc, log) => {
				acc[log.severity] = (acc[log.severity] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		),
	};
};
