import { accountRoutes } from './account.routes';
import { analyticsRoutes } from './analytics.routes';
import { chatRoutes } from './chat.routes';
import { conversationAnalyticsRoutes } from './conversation-analytics.routes';
import { feedbackRoutes } from './feedback.routes';
import { googleRoutes } from './google.routes';
import { guardrailsRoutes } from './guardrails.routes';
import { mcpRoutes } from './mcp.routes';
import { posthogRoutes } from './posthog.routes';
import { projectRoutes } from './project.routes';
import { skillRoutes } from './skill.routes';
import { systemRoutes } from './system.routes';
import { telemetryRoutes } from './telemetry.routes';
import { toolAnalyticsRoutes } from './tool-analytics.routes';
import { transcribeRoutes } from './transcribe.routes';
import { router } from './trpc';
import { usageRoutes } from './usage.routes';
import { userRoutes } from './user.routes';
import { workflowRoutes } from './workflow.routes';

export const trpcRouter = router({
	analytics: analyticsRoutes,
	chat: chatRoutes,
	feedback: feedbackRoutes,
	posthog: posthogRoutes,
	project: projectRoutes,
	usage: usageRoutes,
	user: userRoutes,
	google: googleRoutes,
	account: accountRoutes,
	mcp: mcpRoutes,
	system: systemRoutes,
	skill: skillRoutes,
	telemetry: telemetryRoutes,
	toolAnalytics: toolAnalyticsRoutes,
	conversationAnalytics: conversationAnalyticsRoutes,
	transcribe: transcribeRoutes,
	workflow: workflowRoutes,
	guardrails: guardrailsRoutes,
});

export type TrpcRouter = typeof trpcRouter;
