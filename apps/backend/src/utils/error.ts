export type HandlerErrorCode = 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'TOO_MANY_REQUESTS';

/**
 * A general error class for route/procedure handling errors.
 */
export class HandlerError extends Error {
	readonly codeMessage: HandlerErrorCode;
	readonly code: number;
	readonly metadata?: Record<string, unknown>;

	constructor(codeMessage: HandlerErrorCode, message: string, metadata?: Record<string, unknown>) {
		super(message);
		this.name = 'HandlerError';
		this.codeMessage = codeMessage;
		this.code = httpStatusByHandlerErrorCode[codeMessage] ?? 500;
		this.metadata = metadata;
	}
}

const httpStatusByHandlerErrorCode: Record<HandlerErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	TOO_MANY_REQUESTS: 429,
};
