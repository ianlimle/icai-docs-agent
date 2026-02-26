/**
 * Guardrails utilities for validating and sanitizing user queries
 */

import {
	CustomPattern,
	GuardrailCheckResult,
	GuardrailSeverity,
	GuardrailsValidationResult,
	GuardrailViolationType,
	PIIDetectionResult,
	PIIPatternType,
} from '../types/guardrails';

/**
 * Regex patterns for detecting prompt injection attempts
 */
const PROMPT_INJECTION_PATTERNS = {
	low: [
		/ignore\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/disregard\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/forget\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
	],
	medium: [
		/ignore\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/disregard\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/forget\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/\b(system|assistant|ai)\s*:\s*/i,
		/###\s*(instruction|command|directive)/i,
		/--\s*(instruction|command|directive)/i,
		/#{3,}/, // Multiple hash delimiters
		/-{3,}/, // Multiple dash delimiters
		/pretend\s+(you\s+are|to\s+be)/i,
		/act\s+as\s+(a|an)/i,
		/role\s*play/i,
	],
	high: [
		/ignore\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/disregard\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/forget\s+(all\s+)?(previous|above|the)?\s*(instructions|commands|directive)/i,
		/\b(system|assistant|ai)\s*:\s*/i,
		/###\s*(instruction|command|directive)/i,
		/--\s*(instruction|command|directive)/i,
		/#{3,}/,
		/-{3,}/,
		/pretend\s+(you\s+are|to\s+be)/i,
		/act\s+as\s+(a|an)/i,
		/role\s*play/i,
		/you\s+are\s+now/i,
		/become\s+(a|an)/i,
		/translate\s+this\s+into/i,
		/convert\s+this\s+into/i,
		/output\s+(only|just)/i,
		/print\s+(only|just)/i,
		/return\s+(only|just)/i,
		/\beval\s*\(/i, // Python eval attempts
		/exec\s*\(/i, // Command execution attempts
	],
};

/**
 * Regex patterns for detecting PII (Personally Identifiable Information)
 */
const PII_PATTERNS: Record<PIIPatternType, RegExp> = {
	email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
	phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b\+?1?[-.]?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
	ssn: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
	credit_card: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
	api_key: /\b(AKI|AKIA|sk_|sk-|ghp_|gho_|ghu_|ghs_|ghr_|glpat-)[A-Za-z0-9_-]{16,}\b/g,
	ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
	url: /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi,
	custom: /(?:)/, // Placeholder for custom patterns
};

/**
 * PII redaction placeholder
 */
const PII_REDACTION_PLACEHOLDER = '[REDACTED]';

/**
 * Validate query length
 */
export function validateQueryLength(query: string, maxLength: number): GuardrailCheckResult {
	const length = query.length;
	const passed = length <= maxLength;

	return {
		passed,
		violationType: passed ? undefined : GuardrailViolationType.QueryTooLong,
		severity: passed ? undefined : GuardrailSeverity.Medium,
		message: passed
			? 'Query length is acceptable'
			: `Query exceeds maximum length of ${maxLength} characters (actual: ${length})`,
		originalQuery: query,
		details: { length, maxLength },
	};
}

/**
 * Validate query complexity based on character patterns
 */
export function validateQueryComplexity(query: string, maxComplexity: number): GuardrailCheckResult {
	// Calculate complexity score based on:
	// - Number of special characters
	// - Repeated patterns
	// - Nested brackets/parentheses
	const specialChars = (query.match(/[!@#$%^&*()_+=[\]{};:'"\\|,<>/?]/g) || []).length;
	const repeatedChars = (query.match(/(.)\1{4,}/g) || []).length;
	const brackets = (query.match(/[()[\]{}]/g) || []).length;

	const complexity = specialChars + repeatedChars * 2 + brackets;
	const passed = complexity <= maxComplexity;

	return {
		passed,
		violationType: passed ? undefined : GuardrailViolationType.QueryTooComplex,
		severity: passed ? undefined : GuardrailSeverity.Low,
		message: passed
			? 'Query complexity is acceptable'
			: `Query is too complex (complexity: ${complexity}, max: ${maxComplexity})`,
		originalQuery: query,
		details: { complexity, maxComplexity, specialChars, repeatedChars, brackets },
	};
}

/**
 * Sanitize input by removing dangerous control characters
 */
export function sanitizeInput(query: string): { sanitized: string; hadInvalidChars: boolean } {
	// Remove control characters except newlines, tabs, and carriage returns
	// Also remove null bytes and other invisible characters
	// eslint-disable-next-line no-control-regex
	const sanitized = query.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
	const hadInvalidChars = sanitized !== query;

	// Normalize whitespace
	const normalized = sanitized.replace(/\s+/g, ' ').trim();

	return { sanitized: normalized, hadInvalidChars };
}

/**
 * Check for invalid characters in query
 */
export function validateCharacters(query: string): GuardrailCheckResult {
	const { sanitized, hadInvalidChars } = sanitizeInput(query);

	return {
		passed: !hadInvalidChars || sanitized.length > 0,
		violationType: hadInvalidChars ? GuardrailViolationType.InvalidCharacters : undefined,
		severity: hadInvalidChars ? GuardrailSeverity.Low : undefined,
		message: hadInvalidChars
			? 'Query contains invalid characters that have been removed'
			: 'Query contains valid characters',
		originalQuery: query,
		sanitizedQuery: sanitized,
		details: { hadInvalidChars },
	};
}

/**
 * Detect prompt injection attempts
 */
export function detectPromptInjection(
	query: string,
	strictness: 'low' | 'medium' | 'high' = 'medium',
): GuardrailCheckResult {
	const patterns = PROMPT_INJECTION_PATTERNS[strictness];

	for (const pattern of patterns) {
		if (pattern.test(query)) {
			return {
				passed: false,
				violationType: GuardrailViolationType.PromptInjection,
				severity: GuardrailSeverity.High,
				message: `Query appears to contain prompt injection patterns (strictness: ${strictness})`,
				originalQuery: query,
				details: { strictness, pattern: pattern.source },
			};
		}
	}

	return {
		passed: true,
		message: 'No prompt injection patterns detected',
		originalQuery: query,
	};
}

/**
 * Detect PII in text
 */
export function detectPII(query: string, enabledTypes: PIIPatternType[]): PIIDetectionResult[] {
	const detections: PIIDetectionResult[] = [];

	for (const type of enabledTypes) {
		const pattern = PII_PATTERNS[type];
		const regex = new RegExp(pattern.source, pattern.flags);
		let match;

		while ((match = regex.exec(query)) !== null) {
			detections.push({
				type,
				pattern: pattern.source,
				match: match[0],
				startIndex: match.index,
				endIndex: match.index + match[0].length,
			});
		}
	}

	// Sort by position (descending) for safe redaction
	return detections.sort((a, b) => b.startIndex - a.startIndex);
}

/**
 * Redact PII from text
 */
export function redactPII(query: string, detections: PIIDetectionResult[]): string {
	let redacted = query;

	// Redact from end to start to maintain correct indices
	for (const detection of detections) {
		const before = redacted.substring(0, detection.startIndex);
		const after = redacted.substring(detection.endIndex);
		redacted = before + PII_REDACTION_PLACEHOLDER + after;
	}

	return redacted;
}

/**
 * Check for PII in query
 */
export function checkPII(query: string, enabledTypes: PIIPatternType[], shouldRedact: boolean): GuardrailCheckResult {
	const detections = detectPII(query, enabledTypes);

	if (detections.length === 0) {
		return {
			passed: true,
			message: 'No PII detected',
			originalQuery: query,
		};
	}

	const sanitizedQuery = shouldRedact ? redactPII(query, detections) : query;

	return {
		passed: false, // PII detection is always a violation
		violationType: GuardrailViolationType.PIIDetected,
		severity: GuardrailSeverity.Medium,
		message: `Query contains ${detections.length} PII instance(s)`,
		originalQuery: query,
		sanitizedQuery,
		details: { count: detections.length, types: detections.map((d) => d.type) },
	};
}

/**
 * Check custom allow/block patterns
 */
export function checkCustomPatterns(query: string, patterns: CustomPattern[]): GuardrailCheckResult {
	const enabledPatterns = patterns.filter((p) => p.isEnabled);

	// Check block patterns first
	for (const pattern of enabledPatterns.filter((p) => !p.isAllowed)) {
		try {
			const regex = new RegExp(pattern.pattern, 'gi');
			if (regex.test(query)) {
				return {
					passed: false,
					violationType: GuardrailViolationType.BlockedPattern,
					severity: GuardrailSeverity.Medium,
					message: `Query matches blocked pattern: ${pattern.name}`,
					originalQuery: query,
					details: { patternName: pattern.name, patternId: pattern.id },
				};
			}
		} catch (error) {
			// Invalid regex - log but continue
			console.error(`Invalid regex pattern in ${pattern.name}:`, error);
		}
	}

	return {
		passed: true,
		message: 'Query passes custom pattern checks',
		originalQuery: query,
	};
}

/**
 * Run all guardrail checks on a query
 */
export function validateQuery(
	query: string,
	options: {
		maxLength?: number;
		maxComplexity?: number;
		enablePromptInjectionDetection?: boolean;
		promptInjectionStrictness?: 'low' | 'medium' | 'high';
		enablePIIDetection?: boolean;
		enablePIIRedaction?: boolean;
		piiTypes?: PIIPatternType[];
		customPatterns?: CustomPattern[];
		sanitize?: boolean;
	} = {},
): GuardrailsValidationResult {
	const {
		maxLength = 5000,
		maxComplexity = 100,
		enablePromptInjectionDetection = true,
		promptInjectionStrictness = 'medium',
		enablePIIDetection = true,
		enablePIIRedaction = true,
		piiTypes = [PIIPatternType.Email, PIIPatternType.Phone, PIIPatternType.ApiKey],
		customPatterns = [],
		sanitize = true,
	} = options;

	const checks: GuardrailCheckResult[] = [];
	const violations: GuardrailCheckResult[] = [];
	const warnings: string[] = [];
	let workingQuery = query;

	// Step 1: Sanitize input if enabled
	if (sanitize) {
		const sanitizationResult = validateCharacters(workingQuery);
		checks.push(sanitizationResult);
		if (sanitizationResult.sanitizedQuery) {
			workingQuery = sanitizationResult.sanitizedQuery;
			if (sanitizationResult.hadInvalidChars) {
				warnings.push('Invalid characters were removed from the query');
			}
		}
	}

	// Step 2: Validate length
	const lengthCheck = validateQueryLength(workingQuery, maxLength);
	checks.push(lengthCheck);
	if (!lengthCheck.passed) {
		violations.push(lengthCheck);
	}

	// Step 3: Validate complexity
	const complexityCheck = validateQueryComplexity(workingQuery, maxComplexity);
	checks.push(complexityCheck);
	if (!complexityCheck.passed) {
		violations.push(complexityCheck);
	}

	// Step 4: Check prompt injection
	if (enablePromptInjectionDetection) {
		const injectionCheck = detectPromptInjection(workingQuery, promptInjectionStrictness);
		checks.push(injectionCheck);
		if (!injectionCheck.passed) {
			violations.push(injectionCheck);
		}
	}

	// Step 5: Check custom patterns
	if (customPatterns.length > 0) {
		const patternCheck = checkCustomPatterns(workingQuery, customPatterns);
		checks.push(patternCheck);
		if (!patternCheck.passed) {
			violations.push(patternCheck);
		}
	}

	// Step 6: Detect and redact PII (always run, but may not be a violation)
	let redactedPII: PIIDetectionResult[] = [];
	if (enablePIIDetection && piiTypes.length > 0) {
		const detections = detectPII(workingQuery, piiTypes);
		if (detections.length > 0) {
			redactedPII = detections;
			if (enablePIIRedaction) {
				workingQuery = redactPII(workingQuery, detections);
				warnings.push(`${detections.length} PII instance(s) were redacted`);
			}
		}
	}

	// PII check is only a violation if not redacted (or if redaction is disabled)
	if (enablePIIDetection && !enablePIIRedaction) {
		const piiCheck = checkPII(workingQuery, piiTypes, false);
		checks.push(piiCheck);
		if (!piiCheck.passed) {
			violations.push(piiCheck);
		}
	}

	return {
		valid: violations.length === 0,
		checks,
		violations,
		sanitizedQuery: workingQuery !== query ? workingQuery : undefined,
		warnings,
		redactedPII: redactedPII.length > 0 ? redactedPII : undefined,
	};
}

/**
 * Format guardrail violations for user display
 */
export function formatGuardrailErrors(violations: GuardrailCheckResult[]): string[] {
	return violations.map((v) => {
		switch (v.violationType) {
			case GuardrailViolationType.QueryTooLong:
				return v.message;
			case GuardrailViolationType.QueryTooComplex:
				return 'Your query is too complex. Please simplify it.';
			case GuardrailViolationType.InvalidCharacters:
				return 'Your query contains invalid characters.';
			case GuardrailViolationType.PromptInjection:
				return 'Your query appears to contain instructions that could interfere with normal operation. Please rephrase your question.';
			case GuardrailViolationType.BlockedPattern:
				return 'Your query contains content that is not allowed.';
			case GuardrailViolationType.PIIDetected:
				return 'Your query contains sensitive information. Please remove personal data before submitting.';
			case GuardrailViolationType.RateLimitExceeded:
				return 'You are sending requests too quickly. Please wait a moment before trying again.';
			default:
				return 'Your query could not be processed. Please try rephrasing it.';
		}
	});
}
