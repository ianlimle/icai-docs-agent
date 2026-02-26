import { TRPCError } from '@trpc/server';
import { exec } from 'child_process';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { z } from 'zod/v4';

import s, { DBProject } from '../db/abstractSchema';
import { db } from '../db/db';
import { posthog, PostHogEvent } from '../services/posthog.service';
import { adminProtectedProcedure, projectProtectedProcedure } from './trpc';

const execAsync = promisify(exec);

// Helper function to execute CLI commands
async function executeCliCommand(
	command: string,
	projectPath: string,
): Promise<{ success: boolean; output: string; error?: string }> {
	try {
		const cliPath = path.resolve(process.cwd(), '../../cli');

		const { stdout, stderr } = await execAsync(
			`cd "${projectPath}" && PYTHONPATH="${cliPath}" python -m nao_core.main ${command}`,
			{
				env: {
					...process.env,
					NAO_DEFAULT_PROJECT_PATH: projectPath,
					PYTHONPATH: cliPath,
				},
				timeout: 60000, // 60 second timeout
			},
		);

		return {
			success: true,
			output: stdout || stderr,
		};
	} catch (error) {
		return {
			success: false,
			output: (error as { stdout?: string }).stdout || '',
			error:
				(error as { stderr?: string; message?: string }).stderr || (error as Error).message || 'Unknown error',
		};
	}
}

// Helper to check if project path exists and is valid
async function validateProjectPath(projectPath: string): Promise<{ valid: boolean; error?: string }> {
	try {
		const stats = await fs.stat(projectPath);
		if (!stats.isDirectory()) {
			return { valid: false, error: 'Path is not a directory' };
		}

		// Check for nao_config.yaml
		const configPath = path.join(projectPath, 'nao_config.yaml');
		try {
			await fs.access(configPath);
		} catch {
			return { valid: false, error: 'nao_config.yaml not found. Run "Initialize Project" first.' };
		}

		return { valid: true };
	} catch {
		return { valid: false, error: 'Project path not accessible' };
	}
}

export const workflowRoutes = {
	getStatus: projectProtectedProcedure.query(async ({ ctx }) => {
		if (!ctx.project) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'No project configured',
			});
		}

		const project = ctx.project as DBProject;

		return {
			initCompleted: project.workflowInitCompleted ?? false,
			initCompletedAt: project.workflowInitCompletedAt ?? null,
			debugCompleted: project.workflowDebugCompleted ?? false,
			debugCompletedAt: project.workflowDebugCompletedAt ?? null,
			syncCompleted: project.workflowSyncCompleted ?? false,
			syncCompletedAt: project.workflowSyncCompletedAt ?? null,
			lastError: project.workflowLastError ?? null,
			allCompleted:
				(project.workflowInitCompleted ?? false) &&
				(project.workflowDebugCompleted ?? false) &&
				(project.workflowSyncCompleted ?? false),
		};
	}),

	runInit: projectProtectedProcedure
		.input(
			z.object({
				projectName: z.string().optional(),
				databases: z
					.array(
						z.object({
							id: z.string(),
							type: z.string(),
							name: z.string(),
							connectionString: z.string().optional(),
						}),
					)
					.optional(),
				repos: z
					.array(
						z.object({
							id: z.string(),
							url: z.string(),
							branch: z.string().optional(),
						}),
					)
					.optional(),
				docFiles: z
					.array(
						z.object({
							id: z.string(),
							name: z.string(),
							size: z.number(),
						}),
					)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.project || !ctx.project.path) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Project path not configured',
				});
			}

			try {
				// Validate project path exists
				const pathValidation = await validateProjectPath(ctx.project.path);
				const configExists = pathValidation.valid;

				// Process configuration data
				const { databases = [], repos = [], docFiles = [] } = input;

				// TODO: Integrate these configurations with nao_core CLI
				// For now, we'll log them and continue with the basic init
				if (databases.length > 0 || repos.length > 0 || docFiles.length > 0) {
					console.log('[Workflow Init] Configuration data received:', {
						databases: databases.length,
						repos: repos.length,
						docFiles: docFiles.length,
					});
				}

				let result: { success: boolean; output: string; error?: string };

				// Only run init if config doesn't exist
				// If config exists, init would be interactive, so we skip it
				if (configExists) {
					console.log('[Workflow Init] Config exists, skipping init command');
					result = { success: true, output: 'Configuration already exists' };
				} else {
					// Run nao init
					// Note: init command doesn't accept project name as argument
					// It works in the current directory and detects existing config
					result = await executeCliCommand(`init --force`, ctx.project.path);
				}

				if (!result.success) {
					// Update last error
					await db
						.update(s.project)
						.set({
							workflowLastError: result.error || 'Initialization failed',
						})
						.where(eq(s.project.id, ctx.project.id));

					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: result.error || 'Initialization failed',
						cause: result.output,
					});
				}

				// Mark init as completed
				await db
					.update(s.project)
					.set({
						workflowInitCompleted: true,
						workflowInitCompletedAt: new Date(),
						workflowLastError: null,
					})
					.where(eq(s.project.id, ctx.project.id));

				void posthog.capture(ctx.user.id, PostHogEvent.WorkflowInitCompleted, {
					projectId: ctx.project.id,
				});

				return {
					success: true,
					output: result.output,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}),

	runDebug: projectProtectedProcedure.mutation(async ({ ctx }) => {
		if (!ctx.project || !ctx.project.path) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Project path not configured',
			});
		}

		try {
			// Validate project has been initialized
			if (!ctx.project.workflowInitCompleted) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Project must be initialized first. Run "Initialize Project" step.',
				});
			}

			// Validate project path
			const pathValidation = await validateProjectPath(ctx.project.path);
			if (!pathValidation.valid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: pathValidation.error,
				});
			}

			// Run nao debug
			const result = await executeCliCommand('debug', ctx.project.path);

			if (!result.success) {
				// Update last error
				await db
					.update(s.project)
					.set({
						workflowLastError: result.error || 'Debug verification failed',
					})
					.where(eq(s.project.id, ctx.project.id));

				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: result.error || 'Debug verification failed',
					cause: result.output,
				});
			}

			// Mark debug as completed
			await db
				.update(s.project)
				.set({
					workflowDebugCompleted: true,
					workflowDebugCompletedAt: new Date(),
					workflowLastError: null,
				})
				.where(eq(s.project.id, ctx.project.id));

			void posthog.capture(ctx.user.id, PostHogEvent.WorkflowDebugCompleted, {
				projectId: ctx.project.id,
			});

			return {
				success: true,
				output: result.output,
			};
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}),

	runSync: projectProtectedProcedure.mutation(async ({ ctx }) => {
		if (!ctx.project || !ctx.project.path) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Project path not configured',
			});
		}

		try {
			// Validate project has been initialized and debugged
			if (!ctx.project.workflowInitCompleted) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Project must be initialized first.',
				});
			}
			if (!ctx.project.workflowDebugCompleted) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Project must be verified first. Run "Verify Setup" step.',
				});
			}

			// Validate project path
			const pathValidation = await validateProjectPath(ctx.project.path);
			if (!pathValidation.valid) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: pathValidation.error,
				});
			}

			// Run nao sync
			const result = await executeCliCommand('sync', ctx.project.path);

			if (!result.success) {
				// Update last error
				await db
					.update(s.project)
					.set({
						workflowLastError: result.error || 'Sync failed',
					})
					.where(eq(s.project.id, ctx.project.id));

				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: result.error || 'Sync failed',
					cause: result.output,
				});
			}

			// Mark sync as completed
			await db
				.update(s.project)
				.set({
					workflowSyncCompleted: true,
					workflowSyncCompletedAt: new Date(),
					workflowLastError: null,
				})
				.where(eq(s.project.id, ctx.project.id));

			void posthog.capture(ctx.user.id, PostHogEvent.WorkflowSyncCompleted, {
				projectId: ctx.project.id,
			});

			return {
				success: true,
				output: result.output,
			};
		} catch (error) {
			if (error instanceof TRPCError) {
				throw error;
			}
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}),

	resetWorkflow: adminProtectedProcedure.mutation(async ({ ctx }) => {
		if (!ctx.project) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'No project configured',
			});
		}

		// Reset all workflow status
		await db
			.update(s.project)
			.set({
				workflowInitCompleted: false,
				workflowInitCompletedAt: null,
				workflowDebugCompleted: false,
				workflowDebugCompletedAt: null,
				workflowSyncCompleted: false,
				workflowSyncCompletedAt: null,
				workflowLastError: null,
			})
			.where(eq(s.project.id, ctx.project.id));

		return { success: true };
	}),
};
