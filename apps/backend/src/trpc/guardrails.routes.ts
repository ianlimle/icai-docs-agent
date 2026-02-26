import { TRPCError } from '@trpc/server';
import { z } from 'zod/v4';

import * as guardrailsQueries from '../queries/guardrails.queries';
import { guardrailsService } from '../services/guardrails.service';
import { CustomPattern, GuardrailsSettings } from '../types/guardrails';
import { adminProtectedProcedure, projectProtectedProcedure } from './trpc';

const CustomPatternSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1).max(100),
	pattern: z.string().min(1).max(500),
	isAllowed: z.boolean(),
	isEnabled: z.boolean(),
	description: z.string().optional(),
	createdAt: z.number().optional(),
	updatedAt: z.number().optional(),
});

const GuardrailsSettingsSchema = z.object({
	maxQueryLength: z.number().min(100).max(50000),
	maxQueryComplexity: z.number().min(10).max(1000),
	enableRateLimiting: z.boolean(),
	rateLimitConfig: z.object({
		maxRequestsPerMinute: z.number().min(1).max(100),
		maxRequestsPerHour: z.number().min(10).max(1000),
		burstAllowance: z.number().min(0).max(20),
	}),
	enablePromptInjectionDetection: z.boolean(),
	promptInjectionStrictness: z.enum(['low', 'medium', 'high']),
	enableProfanityFilter: z.boolean(),
	enablePIIDetection: z.boolean(),
	enablePIIRedaction: z.boolean(),
	customPatterns: z.array(CustomPatternSchema),
	enableAuditLogging: z.boolean(),
	auditLogRetentionDays: z.number().min(1).max(365),
	blockOnError: z.boolean(),
	showErrorToUser: z.boolean(),
});

export const guardrailsRoutes = {
	getSettings: projectProtectedProcedure.query(async ({ ctx }) => {
		if (!ctx.project) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Project not found',
			});
		}

		return guardrailsService.getSettings(ctx.project.id);
	}),

	updateSettings: projectProtectedProcedure
		.input(GuardrailsSettingsSchema.partial())
		.mutation(async ({ ctx, input }) => {
			if (!ctx.project) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Project not found',
				});
			}

			await guardrailsService.updateSettings(ctx.project.id, input as Partial<GuardrailsSettings>);

			return { success: true };
		}),

	getAuditLogs: projectProtectedProcedure
		.input(
			z.object({
				eventType: z.string().optional(),
				limit: z.number().min(1).max(500).default(50),
				offset: z.number().min(0).default(0),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			if (!ctx.project) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Project not found',
				});
			}

			const logs = await guardrailsQueries.getAuditLogs({
				projectId: ctx.project.id,
				...input,
			});

			return {
				logs,
				total: logs.length,
			};
		}),

	getStats: projectProtectedProcedure.query(async ({ ctx }) => {
		if (!ctx.project) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Project not found',
			});
		}

		const [serviceStats, auditStats] = await Promise.all([
			guardrailsService.getStats(),
			guardrailsQueries.getAuditLogStats({ projectId: ctx.project.id }),
		]);

		return {
			...serviceStats,
			auditLogs: auditStats,
		};
	}),

	addCustomPattern: projectProtectedProcedure
		.input(CustomPatternSchema.omit({ id: true }))
		.mutation(async ({ ctx, input }) => {
			if (!ctx.project) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Project not found',
				});
			}

			const settings = await guardrailsService.getSettings(ctx.project.id);

			const newPattern = {
				id: crypto.randomUUID(),
				...input,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			settings.customPatterns.push(newPattern as CustomPattern);

			await guardrailsService.updateSettings(ctx.project.id, settings);

			return { success: true, pattern: newPattern };
		}),

	removeCustomPattern: projectProtectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (!ctx.project) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Project not found',
				});
			}

			const settings = await guardrailsService.getSettings(ctx.project.id);

			settings.customPatterns = settings.customPatterns.filter((p) => p.id !== input.id) as CustomPattern[];

			await guardrailsService.updateSettings(ctx.project.id, settings);

			return { success: true };
		}),

	resetSettings: projectProtectedProcedure.mutation(async ({ ctx }) => {
		if (!ctx.project) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'Project not found',
			});
		}

		const { DEFAULT_GUARDRAILS_SETTINGS } = await import('../types/guardrails');
		await guardrailsService.updateSettings(ctx.project.id, DEFAULT_GUARDRAILS_SETTINGS);

		return { success: true };
	}),

	// Admin routes
	getAllAuditLogs: adminProtectedProcedure
		.input(
			z.object({
				userId: z.string().optional(),
				eventType: z.string().optional(),
				limit: z.number().min(1).max(500).default(50),
				offset: z.number().min(0).default(0),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
			}),
		)
		.query(async ({ input }) => {
			const logs = await guardrailsQueries.getAuditLogs(input);

			return {
				logs,
				total: logs.length,
			};
		}),

	getServiceStats: adminProtectedProcedure.query(async () => {
		return guardrailsService.getStats();
	}),
};
