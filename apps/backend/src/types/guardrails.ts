/**
 * Guardrails types and interfaces for user query validation and safety
 */

/**
 * Types of guardrail violations that can occur
 */
export enum GuardrailViolationType {
	// Query validation violations
	QueryTooLong = 'query_too_long',
	QueryTooComplex = 'query_too_complex',
	InvalidCharacters = 'invalid_characters',

	// Content safety violations
	PromptInjection = 'prompt_injection',
	MaliciousContent = 'malicious_content',
	PIIDetected = 'pii_detected',

	// Rate limiting violations
	RateLimitExceeded = 'rate_limit_exceeded',

	// Custom pattern violations
	BlockedPattern = 'blocked_pattern',

	// General validation
	ValidationError = 'validation_error',
}

/**
 * Severity levels for violations
 */
export enum GuardrailSeverity {
	Low = 'low',
	Medium = 'medium',
	High = 'high',
	Critical = 'critical',
}

/**
 * PII types that can be detected and redacted
 */
export enum PIIPatternType {
	Email = 'email',
	Phone = 'phone',
	SSN = 'ssn',
	CreditCard = 'credit_card',
	ApiKey = 'api_key',
	IPAddress = 'ip_address',
	URL = 'url',
	Custom = 'custom',
}

/**
 * PII detection result
 */
export interface PIIDetectionResult {
	type: PIIPatternType;
	pattern: string;
	match: string;
	startIndex: number;
	endIndex: number;
}

/**
 * Result of a single guardrail check
 */
export interface GuardrailCheckResult {
	passed: boolean;
	violationType?: GuardrailViolationType;
	severity?: GuardrailSeverity;
	message: string;
	originalQuery?: string;
	sanitizedQuery?: string;
	details?: Record<string, unknown>;
	hadInvalidChars?: boolean;
}

/**
 * Complete guardrail validation result for a query
 */
export interface GuardrailsValidationResult {
	valid: boolean;
	checks: GuardrailCheckResult[];
	violations: GuardrailCheckResult[];
	sanitizedQuery?: string;
	warnings: string[];
	// PII that was redacted
	redactedPII?: PIIDetectionResult[];
}

/**
 * Rate limit state for a user
 */
export interface RateLimitState {
	userId: string;
	requestCount: number;
	windowStartMs: number;
	windowEndMs: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	maxRequestsPerMinute: number;
	maxRequestsPerHour: number;
	burstAllowance: number; // Allow short bursts above normal rate
}

/**
 * Custom pattern for allow/block lists
 */
export interface CustomPattern {
	id: string;
	name: string;
	pattern: string; // Regex pattern
	isAllowed: boolean; // true = allow list, false = block list
	isEnabled: boolean;
	description?: string;
	createdAt: number;
	updatedAt: number;
}

/**
 * Audit log entry for security events
 */
export interface AuditLogEntry {
	id: string;
	userId: string;
	projectId?: string;
	timestamp: number; // Unix timestamp
	eventType: 'guardrail_blocked' | 'guardrail_warning' | 'rate_limit_exceeded' | 'pii_redacted';
	violationType: GuardrailViolationType;
	severity: GuardrailSeverity;
	query: string;
	sanitizedQuery?: string;
	message: string;
	details?: Record<string, unknown>;
	ipAddress?: string;
	userAgent?: string;
}

/**
 * Guardrails configuration for a project
 */
export interface GuardrailsSettings {
	// Query limits
	maxQueryLength: number;
	maxQueryComplexity: number; // e.g., nesting depth, special char count

	// Rate limiting (per-user)
	enableRateLimiting: boolean;
	rateLimitConfig: RateLimitConfig;

	// Content safety
	enablePromptInjectionDetection: boolean;
	promptInjectionStrictness: 'low' | 'medium' | 'high';
	enableProfanityFilter: boolean;
	enablePIIDetection: boolean;
	enablePIIRedaction: boolean;

	// Custom patterns
	customPatterns: CustomPattern[];

	// Audit logging
	enableAuditLogging: boolean;
	auditLogRetentionDays: number;

	// Blocking behavior
	blockOnError: boolean; // If true, block queries with violations
	showErrorToUser: boolean; // If true, return error to user
}

/**
 * Default guardrails settings
 */
export const DEFAULT_GUARDRAILS_SETTINGS: GuardrailsSettings = {
	maxQueryLength: 5000,
	maxQueryComplexity: 100,
	enableRateLimiting: true,
	rateLimitConfig: {
		maxRequestsPerMinute: 10,
		maxRequestsPerHour: 100,
		burstAllowance: 5,
	},
	enablePromptInjectionDetection: true,
	promptInjectionStrictness: 'medium',
	enableProfanityFilter: false,
	enablePIIDetection: true,
	enablePIIRedaction: true,
	customPatterns: [],
	enableAuditLogging: true,
	auditLogRetentionDays: 7,
	blockOnError: true,
	showErrorToUser: true,
};

/**
 * Guardrail error response format
 */
export interface GuardrailErrorResponse {
	success: false;
	error: {
		type: 'guardrail_violation';
		violations: Array<{
			type: GuardrailViolationType;
			severity: GuardrailSeverity;
			message: string;
		}>;
		sanitizedQuery?: string;
	};
}
