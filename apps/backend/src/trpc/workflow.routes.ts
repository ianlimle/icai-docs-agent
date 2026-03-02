import { TRPCError } from '@trpc/server';
import { exec } from 'child_process';
import { eq } from 'drizzle-orm';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import fs from 'fs/promises';
import * as yaml from 'js-yaml';
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
							content: z.string(), // base64-encoded file content
						}),
					)
					.optional(),
				confluence: z
					.array(
						z.object({
							id: z.string(),
							spaceUrl: z.string(),
							apiToken: z.string().optional(),
							email: z.string().optional(),
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
				const { databases = [], repos = [], docFiles = [], confluence = [] } = input;

				// Save documentation files to docs/ folder
				if (docFiles.length > 0) {
					const docsPath = path.join(ctx.project.path, 'docs');
					if (!existsSync(docsPath)) {
						mkdirSync(docsPath, { recursive: true });
					}

					for (const docFile of docFiles) {
						try {
							// Convert base64 to buffer and write to file
							const buffer = Buffer.from(docFile.content, 'base64');
							const filePath = path.join(docsPath, docFile.name);
							writeFileSync(filePath, buffer);
							console.log(`[Workflow Init] Saved doc file: ${docFile.name}`);
						} catch (error) {
							console.error(`[Workflow Init] Failed to save doc file ${docFile.name}:`, error);
							// Continue with other files even if one fails
						}
					}
				}

				// Update nao_config.yaml with databases and repos
				const configPath = path.join(ctx.project.path, 'nao_config.yaml');
				let config: Record<string, unknown> = { project_name: input.projectName || 'nao-project' };

				// Load existing config if it exists
				if (existsSync(configPath)) {
					try {
						const configContent = readFileSync(configPath, 'utf-8');
						config = yaml.load(configContent) as Record<string, unknown>;
					} catch (error) {
						console.error('[Workflow Init] Failed to load existing config:', error);
					}
				}

				// Update databases
				if (databases.length > 0) {
					// Map frontend database config to YAML format
					config.databases = databases.map((db) => {
						const dbConfig: Record<string, unknown> = {
							type: db.type,
							name: db.name,
						};

						// Parse connection string if provided
						if (db.connectionString) {
							// For postgres, parse the connection string
							if (db.type === 'postgres') {
								try {
									const url = new URL(db.connectionString);
									dbConfig.host = url.hostname;
									dbConfig.port = parseInt(url.port || '5432', 10);
									dbConfig.database = url.pathname.slice(1);
									dbConfig.user = url.username;
									dbConfig.password = url.password;
								} catch {
									// If parsing fails, store as-is
									dbConfig.connectionString = db.connectionString;
								}
							} else {
								dbConfig.connectionString = db.connectionString;
							}
						}

						return dbConfig;
					});
					console.log(`[Workflow Init] Added ${databases.length} database(s) to config`);
				}

				// Update repos
				if (repos.length > 0) {
					config.repos = repos.map((repo) => {
						const repoConfig: Record<string, unknown> = {
							name: repo.url.split('/').pop()?.replace('.git', '') || 'repo',
							url: repo.url,
						};
						if (repo.branch && repo.branch !== 'main') {
							repoConfig.branch = repo.branch;
						}
						return repoConfig;
					});
					console.log(`[Workflow Init] Added ${repos.length} repo(s) to config`);
				}

				// Update confluence
				if (confluence.length > 0) {
					config.confluence = {
						spaces: confluence.map((space) => ({
							space_url: space.spaceUrl,
							api_token: space.apiToken || '',
							email: space.email || '',
						})),
					};
					console.log(`[Workflow Init] Added ${confluence.length} Confluence space(s) to config`);
				}

				// Write updated config back to file
				try {
					const yamlContent = yaml.dump(config, {
						indent: 2,
						lineWidth: -1,
						noRefs: true,
						sortKeys: false,
					});
					writeFileSync(configPath, yamlContent);
					console.log('[Workflow Init] Updated nao_config.yaml');
				} catch (error) {
					console.error('[Workflow Init] Failed to write config:', error);
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: `Failed to write config file: ${error}`,
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
