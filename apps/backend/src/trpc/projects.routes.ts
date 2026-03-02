import { TRPCError } from '@trpc/server';
import { count, eq } from 'drizzle-orm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod/v4';

import s from '../db/abstractSchema';
import { db } from '../db/db';
import * as projectQueries from '../queries/project.queries';
import { optionalProjectProcedure, protectedProcedure, specificProjectProcedure } from './trpc';

export const projectsRoutes = {
	/** List all user's projects with enrichment (role, chat count, active status) */
	list: optionalProjectProcedure.query(async ({ ctx }) => {
		const projects = await projectQueries.getProjectsByUserId(ctx.user.id);

		// Enrich projects with role, chat count, and active status
		const enriched = await Promise.all(
			projects.map(async (project) => {
				const role = await projectQueries.getUserRoleInProject(project.id, ctx.user.id);

				const [chatCountResult] = await db
					.select({ count: count() })
					.from(s.chat)
					.where(eq(s.chat.projectId, project.id))
					.execute();

				const isActive = ctx.project?.id === project.id;

				return {
					...project,
					role,
					chatCount: chatCountResult?.count ?? 0,
					isActive,
				};
			}),
		);

		return enriched;
	}),

	/** Get current active project */
	getActive: optionalProjectProcedure.query(async ({ ctx }) => {
		if (!ctx.project) {
			return null;
		}
		return {
			...ctx.project,
			userRole: ctx.userRole,
		};
	}),

	/** Switch active project */
	setActive: specificProjectProcedure('projectId')
		.input(z.object({ projectId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await projectQueries.setActiveProjectForUser(ctx.user.id, input.projectId);
			return { success: true, projectId: input.projectId };
		}),

	/** Create new project with isolated path */
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().trim().min(1).max(255),
				path: z.string().trim().min(1).max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Helper function to slugify a string
			const slugify = (str: string): string => {
				return str
					.toLowerCase()
					.trim()
					.replace(/[^\w\s-]/g, '')
					.replace(/[\s_-]+/g, '-')
					.replace(/^-+|-+$/g, '');
			};

			// Generate path if not provided - use a projects directory in current working directory
			const projectPath = input.path || join(process.cwd(), 'projects', slugify(input.name));

			// Check if path already exists in database
			const existing = await projectQueries.getProjectByPath(projectPath);
			if (existing) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Project path already exists' });
			}

			// Create directory if it doesn't exist
			if (!existsSync(projectPath)) {
				try {
					mkdirSync(projectPath, { recursive: true });
				} catch (error) {
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: `Failed to create project directory: ${error}`,
					});
				}
			}

			// Initialize as a nao project by creating minimal structure directly
			try {
				// Create folder structure
				const folders = ['databases', 'queries', 'docs', 'semantics', 'repos', 'agent/tools', 'agent/mcps'];
				for (const folder of folders) {
					mkdirSync(join(projectPath, folder), { recursive: true });
				}

				// Create minimal nao_config.yaml
				const configContent = `project_name: ${input.name}
databases: []
repos: []
`;
				writeFileSync(join(projectPath, 'nao_config.yaml'), configContent);

				// Create .naoignore
				writeFileSync(join(projectPath, '.naoignore'), 'templates/\n*.j2\n');

				// Create RULES.md
				writeFileSync(join(projectPath, 'RULES.md'), '');
			} catch (error) {
				// If initialization fails, clean up the directory
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to initialize project: ${error}`,
				});
			}

			// Create project in database
			const project = await projectQueries.createProject({
				name: input.name,
				path: projectPath,
				type: 'local',
			});

			// Add creator as admin
			await projectQueries.addProjectMember({
				userId: ctx.user.id,
				projectId: project.id,
				role: 'admin',
			});

			// Set as active project
			await projectQueries.setActiveProjectForUser(ctx.user.id, project.id);

			return project;
		}),

	/** Delete project with safeguards (admin-only, can't delete only project) */
	delete: specificProjectProcedure('projectId')
		.input(z.object({ projectId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Verify user is admin
			if (ctx.userRole !== 'admin') {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can delete projects' });
			}

			// Get all user's projects
			const userProjects = await projectQueries.getProjectsByUserId(ctx.user.id);

			// Can't delete if it's the only project
			if (userProjects.length <= 1) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot delete your only project',
				});
			}

			// Get chat count for confirmation
			const [chatCountResult] = await db
				.select({ count: count() })
				.from(s.chat)
				.where(eq(s.chat.projectId, input.projectId))
				.execute();

			const chatCount = chatCountResult?.count ?? 0;

			// Delete project (cascade will handle related records)
			await db.delete(s.project).where(eq(s.project.id, input.projectId)).execute();

			// If the deleted project was active, switch to another
			const activeProject = await projectQueries.getActiveProjectByUserId(ctx.user.id);
			if (activeProject?.id === input.projectId) {
				const remainingProjects = userProjects.filter((p) => p.id !== input.projectId);
				if (remainingProjects.length > 0) {
					await projectQueries.setActiveProjectForUser(ctx.user.id, remainingProjects[0].id);
				}
			}

			return { success: true, deletedChats: chatCount };
		}),

	/** Update project name or path */
	update: specificProjectProcedure('projectId')
		.input(
			z.object({
				projectId: z.string(),
				name: z.string().trim().min(1).max(255).optional(),
				path: z.string().trim().min(1).max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user is admin
			if (ctx.userRole !== 'admin') {
				throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can update projects' });
			}

			const updates: Record<string, unknown> = {};
			if (input.name) {
				updates.name = input.name;
			}
			if (input.path) {
				// Check if new path already exists
				const existing = await projectQueries.getProjectByPath(input.path);
				if (existing && existing.id !== input.projectId) {
					throw new TRPCError({ code: 'BAD_REQUEST', message: 'Project path already exists' });
				}
				updates.path = input.path;
			}

			await db.update(s.project).set(updates).where(eq(s.project.id, input.projectId)).execute();

			const updated = await projectQueries.getProjectById(input.projectId);
			return updated;
		}),
};
