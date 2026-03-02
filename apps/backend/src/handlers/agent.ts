import * as chatQueries from '../queries/chat.queries';
import { agentService } from '../services/agent.service';
import { guardrailsService } from '../services/guardrails.service';
import { mcpService } from '../services/mcp.service';
import { skillService } from '../services/skill.service';
import { AgentRequest, AgentRequestUserMessage } from '../types/chat';
import { GuardrailSeverity, GuardrailViolationType } from '../types/guardrails';
import { createChatTitle } from '../utils/ai';
import { HandlerError } from '../utils/error';
import { formatGuardrailErrors, validateQuery } from '../utils/guardrails';

interface HandleAgentMessageInput extends AgentRequest {
	userId: string;
	projectId: string | undefined;
	requestDetails?: { ipAddress?: string; userAgent?: string };
}

interface HandleAgentMessageResult {
	chatId: string;
	isNewChat: boolean;
	modelId: string;
	stream: ReadableStream;
}

/**
 * Guardrails middleware - validates and sanitizes user queries
 */
const validateGuardrails = async (
	userId: string,
	projectId: string,
	query: string,
	requestDetails?: { ipAddress?: string; userAgent?: string },
): Promise<{ query: string; violations?: string[] }> => {
	// 1. Check rate limits first
	const rateLimitCheck = await guardrailsService.checkRateLimit(userId, projectId);
	if (!rateLimitCheck.allowed) {
		const violation = [
			formatGuardrailErrors([
				{
					passed: false,
					violationType: GuardrailViolationType.RateLimitExceeded,
					severity: GuardrailSeverity.Medium,
					message: 'You are sending requests too quickly. Please wait a moment before trying again.',
				},
			])[0],
		];

		await guardrailsService.logViolation(
			userId,
			projectId,
			GuardrailViolationType.RateLimitExceeded,
			GuardrailSeverity.Medium,
			query,
			undefined,
			'Rate limit exceeded',
			{ requestCount: rateLimitCheck.state.requestCount },
			requestDetails,
		);

		throw new HandlerError('TOO_MANY_REQUESTS', violation[0], {
			code: 'RATE_LIMIT_EXCEEDED',
			retryAfter: 60,
		});
	}

	// 2. Get guardrails settings
	const settings = await guardrailsService.getSettings(projectId);

	// 3. Validate and sanitize query
	const validationResult = validateQuery(query, {
		maxLength: settings.maxQueryLength,
		maxComplexity: settings.maxQueryComplexity,
		enablePromptInjectionDetection: settings.enablePromptInjectionDetection,
		promptInjectionStrictness: settings.promptInjectionStrictness,
		enablePIIDetection: settings.enablePIIDetection,
		enablePIIRedaction: settings.enablePIIRedaction,
		customPatterns: settings.customPatterns,
		sanitize: true,
	});

	// 4. Log PII redactions
	if (validationResult.redactedPII && validationResult.redactedPII.length > 0) {
		await guardrailsService.logPIIRedaction(userId, projectId, query, validationResult.sanitizedQuery!, {
			piiCount: validationResult.redactedPII.length,
			types: validationResult.redactedPII.map((p) => p.type),
		});
	}

	// 5. Handle violations
	const errorMessages: string[] = [];

	if (!validationResult.valid) {
		const violations = validationResult.violations;
		const messages = formatGuardrailErrors(violations);
		errorMessages.push(...messages);

		// Log violations
		for (const violation of violations) {
			await guardrailsService.logViolation(
				userId,
				projectId,
				violation.violationType!,
				violation.severity!,
				query,
				validationResult.sanitizedQuery,
				violation.message,
				violation.details,
				requestDetails,
			);
		}

		// Block if configured to do so
		if (settings.blockOnError) {
			throw new HandlerError('BAD_REQUEST', messages.join(' '), {
				code: 'GUARDRAIL_VIOLATION',
				violations: violations.map((v) => ({
					type: v.violationType!,
					severity: v.severity!,
					message: v.message,
				})),
				sanitizedQuery: validationResult.sanitizedQuery,
			});
		}
	}

	// 6. Log warnings
	for (const warning of validationResult.warnings) {
		await guardrailsService.logWarning(
			userId,
			projectId,
			GuardrailViolationType.ValidationError,
			query,
			validationResult.sanitizedQuery,
			warning,
		);
	}

	return {
		query: validationResult.sanitizedQuery || query,
		violations: errorMessages.length > 0 ? errorMessages : undefined,
	};
};

export const handleAgentRoute = async (opts: HandleAgentMessageInput): Promise<HandleAgentMessageResult> => {
	const { userId, message, messageToEditId, model, mentions, projectId, requestDetails } = opts;

	if (!projectId) {
		throw new HandlerError('BAD_REQUEST', 'No project selected. Please create or select a project first.');
	}

	// Validate and sanitize user query through guardrails
	const guardrailsResult = await validateGuardrails(userId, projectId, message.text, requestDetails);

	// Use sanitized query
	const sanitizedMessage = { ...message, text: guardrailsResult.query };

	// If there were non-blocking violations, they're in guardrailsResult.violations
	// We could add them as metadata to the message if needed

	let chatId = opts.chatId;
	const isNewChat = !chatId;
	let newMessageId: string;

	if (!chatId) {
		const [createdChat, createdMessage] = await createChat(userId, projectId, sanitizedMessage);
		chatId = createdChat.id;
		newMessageId = createdMessage.id;
	} else {
		const { messageId } = await insertOrSupersedeMessage({
			userId,
			chatId,
			message: sanitizedMessage,
			messageToEditId,
		});
		newMessageId = messageId;
	}

	const [chat] = await chatQueries.loadChat(chatId);
	if (!chat) {
		throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
	}

	await mcpService.initializeMcpState(projectId);
	await skillService.initializeSkills(projectId);

	const agent = await agentService.create({ ...chat, userId, projectId }, model);

	const stream = agent.stream(chat.messages, {
		mentions,
		events: {
			newChat: isNewChat
				? {
						id: chatId,
						title: chat.title,
						createdAt: chat.createdAt,
						updatedAt: chat.updatedAt,
					}
				: undefined,
			newUserMessage: { newId: newMessageId },
		},
	});

	return {
		chatId,
		isNewChat,
		modelId: agent.getModelId(),
		stream,
	};
};

const createChat = async (userId: string, projectId: string, message: AgentRequestUserMessage) => {
	const title = createChatTitle(message);
	return await chatQueries.createChat({ title, userId, projectId }, message);
};

/** Insert a message into a chat or supersede an existing message when it is edited. */
const insertOrSupersedeMessage = async (opts: {
	userId: string;
	chatId: string;
	message: AgentRequestUserMessage;
	messageToEditId?: string;
}) => {
	const { userId, chatId, message, messageToEditId } = opts;
	const ownerId = await chatQueries.getChatOwnerId(chatId);
	if (!ownerId) {
		throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
	}
	if (ownerId !== userId) {
		throw new HandlerError('FORBIDDEN', 'You are not authorized to access this chat.');
	}
	if (messageToEditId) {
		await chatQueries.supersedeMessagesFrom(chatId, messageToEditId);
	}
	return chatQueries.upsertMessage({
		role: 'user',
		parts: [{ type: 'text', text: message.text }],
		chatId,
	});
};
