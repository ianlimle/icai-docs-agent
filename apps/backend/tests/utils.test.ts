import { IncomingHttpHeaders } from 'node:http';

import { beforeEach, describe, expect, it } from 'vitest';

import {
	convertHeaders,
	formatSize,
	getErrorMessage,
	groupBy,
	isAbortError,
	isEmailDomainAllowed,
	regexPassword,
	removeNewLine,
	replaceEnvVars,
	truncateMiddle,
} from '../src/utils/utils';

describe('truncateMiddle', () => {
	it('returns the string unchanged when shorter than maxLength', () => {
		expect(truncateMiddle('hello', 10)).toBe('hello');
	});

	it('truncates the middle of a long string', () => {
		expect(truncateMiddle('abcdefghij', 7)).toBe('ab...ij');
	});

	it('slices without ellipsis when maxLength <= ellipsis length', () => {
		expect(truncateMiddle('abcdef', 3)).toBe('abc');
	});

	it('uses a custom ellipsis string', () => {
		expect(truncateMiddle('abcdefghij', 8, '--')).toBe('abc--hij');
	});
});

describe('convertHeaders', () => {
	it('should convert simple headers', () => {
		const headers: IncomingHttpHeaders = {
			'content-type': 'application/json',
			accept: 'text/html',
		};
		const converted = convertHeaders(headers);
		expect(converted.get('content-type')).toBe('application/json');
		expect(converted.get('accept')).toBe('text/html');
	});

	it('should handle array header values', () => {
		const headers: IncomingHttpHeaders = {
			accept: ['application/json', 'text/html'],
		};
		const converted = convertHeaders(headers);
		// Headers API adds a space after comma when joining
		expect(converted.get('accept')).toBe('application/json, text/html');
	});

	it('should skip undefined header values', () => {
		const headers: IncomingHttpHeaders = {
			'content-type': 'application/json',
			'x-forwarded-for': undefined,
		};
		const converted = convertHeaders(headers);
		expect(converted.get('content-type')).toBe('application/json');
		expect(converted.has('x-forwarded-for')).toBe(false);
	});
});

describe('isAbortError', () => {
	it('should identify AbortError', () => {
		const error = new Error('Aborted');
		error.name = 'AbortError';
		expect(isAbortError(error)).toBe(true);
	});

	it('should return false for other errors', () => {
		const error = new Error('Some other error');
		expect(isAbortError(error)).toBe(false);
	});

	it('should return false for non-error objects', () => {
		expect(isAbortError('string')).toBe(false);
		expect(isAbortError(null)).toBe(false);
		expect(isAbortError(undefined)).toBe(false);
	});
});

describe('getErrorMessage', () => {
	it('should return null for null/undefined', () => {
		expect(getErrorMessage(null)).toBe(null);
		expect(getErrorMessage(undefined)).toBe(null);
	});

	it('should return error message for Error objects', () => {
		const error = new Error('Test error');
		expect(getErrorMessage(error)).toBe('Test error');
	});

	it('should convert non-error objects to string', () => {
		expect(getErrorMessage('string error')).toBe('string error');
		expect(getErrorMessage(123)).toBe('123');
		expect(getErrorMessage({ message: 'obj' })).toBe('[object Object]');
	});
});

describe('isEmailDomainAllowed', () => {
	it('should return true when authDomains is not specified', () => {
		expect(isEmailDomainAllowed('user@example.com')).toBe(true);
	});

	it('should return true for allowed domains', () => {
		expect(isEmailDomainAllowed('user@example.com', 'example.com,test.com')).toBe(true);
		expect(isEmailDomainAllowed('user@test.com', 'example.com,test.com')).toBe(true);
	});

	it('should be case-insensitive', () => {
		expect(isEmailDomainAllowed('user@Example.com', 'example.com')).toBe(true);
		expect(isEmailDomainAllowed('user@EXAMPLE.COM', 'example.com')).toBe(true);
	});

	it('should return false for non-allowed domains', () => {
		expect(isEmailDomainAllowed('user@other.com', 'example.com,test.com')).toBe(false);
	});

	it('should return false for invalid email addresses', () => {
		expect(isEmailDomainAllowed('invalid-email', 'example.com')).toBe(false);
		// '@example.com' is technically valid (empty local-part) with domain 'example.com'
		// So it returns true when 'example.com' is in allowed domains
		expect(isEmailDomainAllowed('user@', 'example.com')).toBe(false);
		expect(isEmailDomainAllowed('@', 'example.com')).toBe(false);
	});

	it('should handle whitespace in authDomains', () => {
		expect(isEmailDomainAllowed('user@example.com', ' example.com , test.com ')).toBe(true);
	});
});

describe('regexPassword', () => {
	it('should match valid passwords', () => {
		// At least 8 chars, uppercase, lowercase, number, special char
		expect(regexPassword.test('Password1!')).toBe(true);
		expect(regexPassword.test('Abcdef12#')).toBe(true);
		expect(regexPassword.test('MyP@ssw0rd')).toBe(true);
	});

	it('should reject passwords without uppercase', () => {
		expect(regexPassword.test('password1!')).toBe(false);
	});

	it('should reject passwords without lowercase', () => {
		expect(regexPassword.test('PASSWORD1!')).toBe(false);
	});

	it('should reject passwords without numbers', () => {
		expect(regexPassword.test('Password!')).toBe(false);
	});

	it('should reject passwords without special chars', () => {
		expect(regexPassword.test('Password1')).toBe(false);
	});

	it('should reject passwords shorter than 8 chars', () => {
		expect(regexPassword.test('Pass1!')).toBe(false);
	});
});

describe('replaceEnvVars', () => {
	beforeEach(() => {
		// Clear and set test environment variables
		delete process.env.TEST_VAR;
		delete process.env.ANOTHER_VAR;
		process.env.TEST_VAR = 'test-value';
		process.env.ANOTHER_VAR = 'another-value';
	});

	it('should replace environment variables', () => {
		const content = 'Hello ${TEST_VAR} World';
		expect(replaceEnvVars(content)).toBe('Hello test-value World');
	});

	it('should replace multiple environment variables', () => {
		const content = '${TEST_VAR} and ${ANOTHER_VAR}';
		expect(replaceEnvVars(content)).toBe('test-value and another-value');
	});

	it('should leave unknown variables as-is', () => {
		const content = 'Value: ${UNKNOWN_VAR}';
		expect(replaceEnvVars(content)).toBe('Value: ${UNKNOWN_VAR}');
	});

	it('should handle mixed content', () => {
		const content = 'Prefix ${TEST_VAR} suffix ${UNKNOWN_VAR}';
		expect(replaceEnvVars(content)).toBe('Prefix test-value suffix ${UNKNOWN_VAR}');
	});

	it('should handle empty string', () => {
		expect(replaceEnvVars('')).toBe('');
	});

	it('should handle content without env vars', () => {
		expect(replaceEnvVars('No vars here')).toBe('No vars here');
	});
});

describe('removeNewLine', () => {
	it('should remove \\n characters', () => {
		expect(removeNewLine('line1\nline2')).toBe('line1line2');
	});

	it('should remove \\r characters', () => {
		expect(removeNewLine('line1\rline2')).toBe('line1line2');
	});

	it('should remove \\r\\n sequences', () => {
		expect(removeNewLine('line1\r\nline2')).toBe('line1line2');
	});

	it('should handle multiple newlines', () => {
		expect(removeNewLine('line1\n\n\nline2')).toBe('line1line2');
	});

	it('should handle empty string', () => {
		expect(removeNewLine('')).toBe('');
	});

	it('should handle string without newlines', () => {
		expect(removeNewLine('single line')).toBe('single line');
	});
});

describe('groupBy', () => {
	interface Item {
		category: string;
		value: number;
		active: boolean;
	}

	const items: Item[] = [
		{ category: 'A', value: 1, active: true },
		{ category: 'B', value: 2, active: true },
		{ category: 'A', value: 3, active: true },
		{ category: 'B', value: 4, active: false },
		{ category: 'C', value: 5, active: true },
	];

	it('should group items by key function', () => {
		const grouped = groupBy(items, (item) => item.category);
		expect(Object.keys(grouped)).toEqual(['A', 'B', 'C']);
		expect(grouped.A).toHaveLength(2);
		expect(grouped.B).toHaveLength(2);
		expect(grouped.C).toHaveLength(1);
	});

	it('should filter items when filterFn is provided', () => {
		const grouped = groupBy(
			items,
			(item) => item.category,
			(item) => item.active,
		);
		expect(grouped.A).toHaveLength(2);
		expect(grouped.B).toHaveLength(1); // Only active items
		expect(grouped.C).toHaveLength(1);
	});

	it('should return empty object for empty array', () => {
		const grouped = groupBy([], (item) => item.category);
		expect(grouped).toEqual({});
	});

	it('should handle non-existent keys after filtering', () => {
		const grouped = groupBy(
			items,
			(item) => item.category,
			(item) => item.value > 10,
		);
		expect(grouped).toEqual({});
	});
});

describe('formatSize', () => {
	it('should format bytes', () => {
		expect(formatSize(0)).toBe('0 B');
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(1023)).toBe('1023 B');
	});

	it('should format kilobytes', () => {
		expect(formatSize(1024)).toBe('1.0 KB');
		expect(formatSize(1536)).toBe('1.5 KB');
		expect(formatSize(1024 * 1024 - 1)).toBe('1024.0 KB');
	});

	it('should format megabytes', () => {
		expect(formatSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
		expect(formatSize(5.5 * 1024 * 1024)).toBe('5.5 MB');
	});

	it('should handle large numbers', () => {
		expect(formatSize(10 * 1024 * 1024)).toBe('10.0 MB');
		expect(formatSize(1024 * 1024 * 1024)).toBe('1024.0 MB');
	});
});
