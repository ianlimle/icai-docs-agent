/**
 * Migration service for setting active project for existing users
 *
 * This service handles data migrations that need to run when schema changes
 * require updating existing user data.
 */

import { eq } from 'drizzle-orm';

import s from '../db/abstractSchema';
import { db } from '../db/db';
import * as projectQueries from '../queries/project.queries';

/**
 * Migrate existing users to have active project set in user_preferences
 *
 * This function:
 * 1. Gets all users
 * 2. For each user, finds their existing project using the old method (default project path)
 * 3. Sets that project as active in user_preferences table
 *
 * This ensures backward compatibility for existing users after the multi-project
 * feature was introduced.
 */
export async function migrateUserActiveProjects(): Promise<{
	migrated: number;
	skipped: number;
	errors: Array<{ userId: string; error: string }>;
}> {
	const users = await db.select().from(s.user).execute();

	const result = {
		migrated: 0,
		skipped: 0,
		errors: [] as Array<{ userId: string; error: string }>,
	};

	for (const user of users) {
		try {
			// Check if user already has active project set
			const [existingPref] = await db
				.select()
				.from(s.userPreferences)
				.where(eq(s.userPreferences.userId, user.id))
				.execute();

			if (existingPref?.activeProjectId) {
				result.skipped++;
				continue;
			}

			// Get user's existing project using the old method
			const existingProject = await projectQueries.getProjectByUserId(user.id);

			if (existingProject) {
				// Set as active project
				await projectQueries.setActiveProjectForUser(user.id, existingProject.id);
				result.migrated++;
			} else {
				result.skipped++;
			}
		} catch (error) {
			result.errors.push({
				userId: user.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	return result;
}
