/**
 * Guardrails service for rate limiting and audit logging
 */

import * as guardrailsQueries from '../queries/guardrails.queries';
import {
	AuditLogEntry,
	DEFAULT_GUARDRAILS_SETTINGS,
	GuardrailSeverity,
	GuardrailsSettings,
	GuardrailViolationType,
	RateLimitState,
} from '../types/guardrails';

/**
 * In-memory rate limit store (map of userId -> RateLimitState)
 * For production, consider using Redis or a dedicated cache
 */
class RateLimitStore {
	private _store = new Map<string, RateLimitState>();

	/**
	 * Get rate limit state for a user
	 */
	get(userId: string): RateLimitState | undefined {
		return this._store.get(userId);
	}

	/**
	 * Set rate limit state for a user
	 */
	set(userId: string, state: RateLimitState): void {
		this._store.set(userId, state);
	}

	/**
	 * Increment request count for a user
	 */
	increment(userId: string): RateLimitState {
		const existing = this._store.get(userId);
		const now = Date.now();

		if (existing) {
			// Check if we're still within the window
			if (now < existing.windowEndMs) {
				existing.requestCount++;
				return existing;
			}
		}

		// Create new window (1 minute)
		const newState: RateLimitState = {
			userId,
			requestCount: 1,
			windowStartMs: now,
			windowEndMs: now + 60000, // 1 minute
		};

		this._store.set(userId, newState);
		return newState;
	}

	/**
	 * Reset rate limit for a user
	 */
	reset(userId: string): void {
		this._store.delete(userId);
	}

	/**
	 * Clean up expired entries (call periodically)
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [userId, state] of this._store.entries()) {
			if (now >= state.windowEndMs) {
				this._store.delete(userId);
			}
		}
	}

	/**
	 * Get all active rate limit states (for debugging/monitoring)
	 */
	getAll(): RateLimitState[] {
		return Array.from(this._store.values());
	}
}

/**
 * Audit log manager with retention policy
 */
class AuditLogManager {
	private _retentionDays: number = 7;

	/**
	 * Set retention period for audit logs
	 */
	setRetentionDays(days: number): void {
		this._retentionDays = days;
	}

	/**
	 * Get retention period
	 */
	getRetentionDays(): number {
		return this._retentionDays;
	}

	/**
	 * Write an audit log entry
	 */
	async write(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
		// Store in database
		return guardrailsQueries.createAuditLog({
			userId: entry.userId,
			projectId: entry.projectId,
			timestamp: Date.now(),
			eventType: entry.eventType,
			violationType: entry.violationType,
			severity: entry.severity,
			query: entry.query,
			sanitizedQuery: entry.sanitizedQuery,
			message: entry.message,
			details: entry.details as Record<string, unknown>,
			ipAddress: entry.ipAddress,
			userAgent: entry.userAgent,
		});
	}

	/**
	 * Clean up old audit logs based on retention policy
	 */
	async cleanup(): Promise<void> {
		const deleted = await guardrailsQueries.deleteOldAuditLogs(this._retentionDays);
		console.log(`[AUDIT] Cleaned up ${deleted} audit logs older than ${this._retentionDays} days`);
	}
}

/**
 * Guardrails service
 */
export class GuardrailsService {
	private static _instance: GuardrailsService;
	private _rateLimitStore = new RateLimitStore();
	private _auditLogManager = new AuditLogManager();
	private _settings = new Map<string, GuardrailsSettings>();

	// Periodic cleanup interval (5 minutes)
	private _cleanupInterval: NodeJS.Timeout | null = null;

	private constructor() {
		// Start periodic cleanup
		this._startPeriodicCleanup();
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): GuardrailsService {
		if (!GuardrailsService._instance) {
			GuardrailsService._instance = new GuardrailsService();
		}
		return GuardrailsService._instance;
	}

	/**
	 * Get guardrails settings for a project
	 */
	async getSettings(projectId: string): Promise<GuardrailsSettings> {
		// Check cache first
		if (this._settings.has(projectId)) {
			return this._settings.get(projectId)!;
		}

		// Load from database
		const settings = await guardrailsQueries.getGuardrailsSettings(projectId);
		this._settings.set(projectId, settings);

		return settings;
	}

	/**
	 * Update guardrails settings for a project
	 */
	async updateSettings(projectId: string, settings: Partial<GuardrailsSettings>): Promise<void> {
		const current = await this.getSettings(projectId);
		const updated = { ...current, ...settings };

		this._settings.set(projectId, updated);

		// Update audit log retention if changed
		if (settings.auditLogRetentionDays !== undefined) {
			this._auditLogManager.setRetentionDays(settings.auditLogRetentionDays);
		}

		// Save to database
		await guardrailsQueries.updateGuardrailsSettings(projectId, updated);
	}

	/**
	 * Check rate limit for a user
	 */
	async checkRateLimit(userId: string, projectId?: string): Promise<{ allowed: boolean; state: RateLimitState }> {
		const settings = projectId ? await this.getSettings(projectId) : DEFAULT_GUARDRAILS_SETTINGS;

		if (!settings.enableRateLimiting) {
			return { allowed: true, state: { userId, requestCount: 0, windowStartMs: 0, windowEndMs: 0 } };
		}

		const state = this._rateLimitStore.increment(userId);
		const { maxRequestsPerMinute, burstAllowance } = settings.rateLimitConfig;

		// Check if over limit (with burst allowance)
		const allowed = state.requestCount <= maxRequestsPerMinute + burstAllowance;

		// Log if rate limited
		if (!allowed && projectId) {
			await this._auditLogManager.write({
				userId,
				projectId,
				eventType: 'rate_limit_exceeded',
				violationType: GuardrailViolationType.RateLimitExceeded,
				severity: GuardrailSeverity.Medium,
				query: '',
				message: `Rate limit exceeded: ${state.requestCount} requests in current window`,
				details: { requestCount: state.requestCount, maxRequestsPerMinute },
			});
		}

		return { allowed, state };
	}

	/**
	 * Reset rate limit for a user (admin function)
	 */
	resetRateLimit(userId: string): void {
		this._rateLimitStore.reset(userId);
	}

	/**
	 * Get current rate limit state for a user
	 */
	getRateLimitState(userId: string): RateLimitState | undefined {
		return this._rateLimitStore.get(userId);
	}

	/**
	 * Log a guardrail violation
	 */
	async logViolation(
		userId: string,
		projectId: string | undefined,
		violationType: GuardrailViolationType,
		severity: GuardrailSeverity,
		query: string,
		sanitizedQuery: string | undefined,
		message: string,
		details?: Record<string, unknown>,
		requestDetails?: { ipAddress?: string; userAgent?: string },
	): Promise<string> {
		return this._auditLogManager.write({
			userId,
			projectId,
			eventType: 'guardrail_blocked',
			violationType,
			severity,
			query,
			sanitizedQuery,
			message,
			details,
			...requestDetails,
		});
	}

	/**
	 * Log a warning (non-blocking violation)
	 */
	async logWarning(
		userId: string,
		projectId: string | undefined,
		violationType: GuardrailViolationType,
		query: string,
		sanitizedQuery: string | undefined,
		message: string,
		details?: Record<string, unknown>,
	): Promise<string> {
		return this._auditLogManager.write({
			userId,
			projectId,
			eventType: 'guardrail_warning',
			violationType,
			severity: GuardrailSeverity.Low,
			query,
			sanitizedQuery,
			message,
			details,
		});
	}

	/**
	 * Log PII redaction
	 */
	async logPIIRedaction(
		userId: string,
		projectId: string | undefined,
		query: string,
		sanitizedQuery: string,
		details: Record<string, unknown>,
	): Promise<string> {
		return this._auditLogManager.write({
			userId,
			projectId,
			eventType: 'pii_redacted',
			violationType: GuardrailViolationType.PIIDetected,
			severity: GuardrailSeverity.Low,
			query,
			sanitizedQuery,
			message: 'PII was redacted from query',
			details,
		});
	}

	/**
	 * Get audit log retention period
	 */
	getAuditLogRetentionDays(): number {
		return this._auditLogManager.getRetentionDays();
	}

	/**
	 * Set audit log retention period
	 */
	setAuditLogRetentionDays(days: number): void {
		this._auditLogManager.setRetentionDays(days);
	}

	/**
	 * Clean up old audit logs
	 */
	async cleanupAuditLogs(): Promise<void> {
		await this._auditLogManager.cleanup();
	}

	/**
	 * Start periodic cleanup of rate limit store and audit logs
	 */
	private _startPeriodicCleanup(): void {
		if (this._cleanupInterval) {
			return;
		}

		// Run cleanup every 5 minutes
		this._cleanupInterval = setInterval(
			() => {
				this._rateLimitStore.cleanup();
				this._auditLogManager.cleanup().catch((error) => {
					console.error('[Guardrails] Cleanup error:', error);
				});
			},
			5 * 60 * 1000,
		);
	}

	/**
	 * Stop periodic cleanup (for graceful shutdown)
	 */
	stopPeriodicCleanup(): void {
		if (this._cleanupInterval) {
			clearInterval(this._cleanupInterval);
			this._cleanupInterval = null;
		}
	}

	/**
	 * Get statistics for monitoring (admin function)
	 */
	async getStats(): Promise<{
		rateLimitEntries: number;
		activeUsers: number;
		auditLogRetentionDays: number;
		projectsConfigured: number;
	}> {
		return {
			rateLimitEntries: this._rateLimitStore.getAll().length,
			activeUsers: new Set(this._rateLimitStore.getAll().map((s) => s.userId)).size,
			auditLogRetentionDays: this._auditLogManager.getRetentionDays(),
			projectsConfigured: this._settings.size,
		};
	}
}

// Export singleton instance
export const guardrailsService = GuardrailsService.getInstance();
