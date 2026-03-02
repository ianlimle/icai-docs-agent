import dbConfig, { Dialect } from './dbConfig';
import * as pgSchema from './pg-schema';
import * as sqliteSchema from './sqlite-schema';

export type { AgentSettings } from '../types/agent-settings';

const allSchema = dbConfig.dialect === Dialect.Postgres ? pgSchema : sqliteSchema;

export type NewUser = typeof sqliteSchema.user.$inferInsert;
export type User = typeof sqliteSchema.user.$inferSelect;

export type NewAccount = typeof sqliteSchema.account.$inferInsert;
export type Account = typeof sqliteSchema.account.$inferSelect;

export type NewChat = typeof sqliteSchema.chat.$inferInsert;
export type DBChat = typeof sqliteSchema.chat.$inferSelect;

export type DBChatMessage = typeof sqliteSchema.chatMessage.$inferSelect;
export type NewChatMessage = typeof sqliteSchema.chatMessage.$inferInsert;

export type DBMessagePart = typeof sqliteSchema.messagePart.$inferSelect;
export type NewMessagePart = typeof sqliteSchema.messagePart.$inferInsert;

export type MessageFeedback = typeof sqliteSchema.messageFeedback.$inferSelect;
export type NewMessageFeedback = typeof sqliteSchema.messageFeedback.$inferInsert;

export type DBProject = typeof sqliteSchema.project.$inferSelect;
export type NewProject = typeof sqliteSchema.project.$inferInsert;

export type DBProjectMember = typeof sqliteSchema.projectMember.$inferSelect;
export type NewProjectMember = typeof sqliteSchema.projectMember.$inferInsert;

export type DBProjectLlmConfig = typeof sqliteSchema.projectLlmConfig.$inferSelect;
export type NewProjectLlmConfig = typeof sqliteSchema.projectLlmConfig.$inferInsert;

export type DBOrganization = typeof sqliteSchema.organization.$inferSelect;
export type NewOrganization = typeof sqliteSchema.organization.$inferInsert;

export type DBOrgMember = typeof sqliteSchema.orgMember.$inferSelect;
export type NewOrgMember = typeof sqliteSchema.orgMember.$inferInsert;

export type DBProjectSavedPrompt = typeof sqliteSchema.projectSavedPrompt.$inferSelect;
export type NewProjectSavedPrompt = typeof sqliteSchema.projectSavedPrompt.$inferInsert;

export type DBMemory = typeof sqliteSchema.memories.$inferSelect;
export type DBNewMemory = typeof sqliteSchema.memories.$inferInsert;

export type DBStageTelemetry = typeof sqliteSchema.stageTelemetry.$inferSelect;
export type NewStageTelemetry = typeof sqliteSchema.stageTelemetry.$inferInsert;

export type DBAuditLog = typeof sqliteSchema.auditLogs.$inferSelect;
export type NewAuditLog = typeof sqliteSchema.auditLogs.$inferInsert;

export type DBGuardrailsSettings = typeof sqliteSchema.guardrailsSettings.$inferSelect;
export type NewGuardrailsSettings = typeof sqliteSchema.guardrailsSettings.$inferInsert;

export type DBUserPreferences = typeof sqliteSchema.userPreferences.$inferSelect;
export type NewUserPreferences = typeof sqliteSchema.userPreferences.$inferInsert;

// Re-export schema tables for easier importing
export const { auditLogs, guardrailsSettings, userPreferences } = allSchema;

export default allSchema as typeof sqliteSchema;
