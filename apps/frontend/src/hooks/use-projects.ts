import { useMutation, useQuery } from '@tanstack/react-query';
import { trpc } from '@/main';

// Define the enriched project type based on the API response
export interface EnrichedProject {
	id: string;
	name: string;
	path: string | null;
	type: 'local';
	chatCount: number;
	role: 'admin' | 'user' | 'viewer' | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Get all user's projects with enrichment */
export function useProjectsList() {
	return useQuery(trpc.projects.list.queryOptions());
}

/** Get current active project */
export function useActiveProject() {
	return useQuery(trpc.projects.getActive.queryOptions());
}

/** Switch active project mutation */
export function useSwitchProject() {
	return useMutation(
		trpc.projects.setActive.mutationOptions({
			onSuccess: (_, variables, __, ctx) => {
				// Invalidate both projects list and active project queries
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.getActive.queryKey(),
				});
				// Invalidate project-specific queries that depend on active project
				ctx.client.invalidateQueries({
					queryKey: trpc.project.getCurrent.queryKey(),
				});
			},
		}),
	);
}

/** Create project mutation */
export function useCreateProject() {
	return useMutation(
		trpc.projects.create.mutationOptions({
			onSuccess: (_, __, ___, ctx) => {
				// Invalidate projects list and active project
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.getActive.queryKey(),
				});
			},
		}),
	);
}

/** Delete project mutation */
export function useDeleteProject() {
	return useMutation(
		trpc.projects.delete.mutationOptions({
			onSuccess: (_, __, ___, ctx) => {
				// Invalidate projects list and active project
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.getActive.queryKey(),
				});
				// Invalidate project-specific queries
				ctx.client.invalidateQueries({
					queryKey: trpc.project.getCurrent.queryKey(),
				});
			},
		}),
	);
}

/** Update project mutation */
export function useUpdateProject() {
	return useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: (_, __, ___, ctx) => {
				// Invalidate projects list
				ctx.client.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
			},
		}),
	);
}
