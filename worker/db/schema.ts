import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
  deactivatedAt: text("deactivated_at"),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const authCredentials = sqliteTable("auth_credentials", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: text("password_changed_at").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const accountInvitations = sqliteTable("account_invitations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  emailSnapshot: text("email_snapshot").notNull(),
  tokenDigest: text("token_digest").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  revokedAt: text("revoked_at"),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("account_invitations_token_unique").on(table.tokenDigest),
  index("account_invitations_user_active_idx").on(table.userId, table.expiresAt),
]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  tokenDigest: text("token_digest").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  idleExpiresAt: text("idle_expires_at").notNull(),
  revokedAt: text("revoked_at"),
  replacedBySessionId: text("replaced_by_session_id"),
}, (table) => [
  uniqueIndex("auth_sessions_token_unique").on(table.tokenDigest),
  index("auth_sessions_user_active_idx").on(table.userId, table.expiresAt),
]);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  tokenDigest: text("token_digest").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("password_reset_tokens_token_unique").on(table.tokenDigest)]);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  keyHash: text("key_hash").notNull(),
  action: text("action").notNull(),
  windowStartedAt: text("window_started_at").notNull(),
  attempts: integer("attempts").notNull(),
  blockedUntil: text("blocked_until"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.keyHash, table.action] }), index("auth_rate_limits_cleanup_idx").on(table.updatedAt)]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  key: text("key", { enum: ["admin", "coordinator", "employee"] }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
}, (table) => [uniqueIndex("roles_key_unique").on(table.key)]);

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  grantedAt: text("granted_at").notNull(),
  grantedByUserId: text("granted_by_user_id").references(() => users.id, { onDelete: "restrict" }),
  revokedAt: text("revoked_at"),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  createdAt: text("created_at").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "restrict" }),
}, (table) => [index("team_members_current_idx").on(table.teamId, table.endsAt), index("team_members_user_idx").on(table.userId, table.endsAt)]);

export const teamCoordinators = sqliteTable("team_coordinators", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "restrict" }),
}, (table) => [index("team_coordinators_current_idx").on(table.teamId, table.endsAt)]);

export const holidays = sqliteTable("holidays", {
  localDate: text("local_date").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope", { enum: ["national", "state", "fortaleza", "company"] }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const feedbackSchedules = sqliteTable("feedback_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Fortaleza"),
  anchorOpenLocalDate: text("anchor_open_local_date").notNull(),
  intervalDays: integer("interval_days").notNull().default(14),
  openLocalTime: text("open_local_time").notNull().default("09:00:00"),
  closeLocalTime: text("close_local_time").notNull().default("23:59:59"),
  reportLocalTime: text("report_local_time").notNull().default("09:00:00"),
  anonymityThreshold: integer("anonymity_threshold").notNull().default(3),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
}, (table) => [
  index("feedback_schedules_active_idx").on(table.isActive),
]);

export const feedbackCycles = sqliteTable("feedback_cycles", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").notNull().references(() => feedbackSchedules.id, { onDelete: "restrict" }),
  sequenceNumber: integer("sequence_number").notNull(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
  reportAt: text("report_at").notNull(),
  employeeEmailAt: text("employee_email_at").notNull(),
  coordinatorEmailAt: text("coordinator_email_at").notNull(),
  status: text("status", { enum: ["scheduled", "open", "closed", "reported", "cancelled"] }).notNull(),
  anonymityThresholdSnapshot: integer("anonymity_threshold_snapshot").notNull(),
  createdAt: text("created_at").notNull(),
  openedAt: text("opened_at"),
  closedAt: text("closed_at"),
  reportedAt: text("reported_at"),
}, (table) => [
  uniqueIndex("feedback_cycles_schedule_sequence_unique").on(table.scheduleId, table.sequenceNumber),
  index("feedback_cycles_due_idx").on(table.status, table.opensAt, table.closesAt, table.reportAt),
]);

export const feedbackCycleParticipants = sqliteTable("feedback_cycle_participants", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => feedbackCycles.id, { onDelete: "restrict" }),
  employeeUserId: text("employee_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  coordinatorUserId: text("coordinator_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  eligibilityStatus: text("eligibility_status", { enum: ["eligible", "excluded"] }).notNull(),
  exclusionReason: text("exclusion_reason"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("feedback_cycle_participant_unique").on(table.cycleId, table.employeeUserId, table.teamId)]);

export const feedbackSubmissions = sqliteTable("feedback_submissions", {
  id: text("id").primaryKey(),
  cycleId: text("cycle_id").notNull().references(() => feedbackCycles.id, { onDelete: "restrict" }),
  participantId: text("participant_id").notNull().references(() => feedbackCycleParticipants.id, { onDelete: "restrict" }),
  submittedAt: text("submitted_at").notNull(),
  state: text("state", { enum: ["submitted", "withdrawn"] }).notNull(),
  schemaVersion: integer("schema_version").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("feedback_submissions_participant_unique").on(table.participantId)]);

export const feedbackAnswers = sqliteTable("feedback_answers", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => feedbackSubmissions.id, { onDelete: "restrict" }),
  dimension: text("dimension", { enum: ["coordinator", "team", "work"] }).notNull(),
  questionKey: text("question_key").notNull(),
  numericValue: integer("numeric_value"),
  textValue: text("text_value"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("feedback_answers_submission_idx").on(table.submissionId)]);

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(), key: text("key").notNull(), label: text("label").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [uniqueIndex("topics_key_unique").on(table.key)]);

export const feedbackAnswerTopics = sqliteTable("feedback_answer_topics", {
  feedbackAnswerId: text("feedback_answer_id").notNull().references(() => feedbackAnswers.id, { onDelete: "restrict" }),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "restrict" }),
}, (table) => [primaryKey({ columns: [table.feedbackAnswerId, table.topicId] })]);

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(), employeeUserId: text("employee_user_id").notNull().references(() => users.id),
  coordinatorUserId: text("coordinator_user_id").notNull().references(() => users.id), teamId: text("team_id").references(() => teams.id),
  scheduledFor: text("scheduled_for").notNull(), heldAt: text("held_at"),
  status: text("status", { enum: ["planned", "completed", "cancelled"] }).notNull(), contextSummary: text("context_summary"), ...timestamps,
});

export const meetingAssessments = sqliteTable("meeting_assessments", {
  id: text("id").primaryKey(), meetingId: text("meeting_id").notNull().references(() => meetings.id), dimensionKey: text("dimension_key").notNull(),
  rating: integer("rating").notNull(), note: text("note"), visibility: text("visibility").notNull(), createdByUserId: text("created_by_user_id").notNull().references(() => users.id), ...timestamps,
});

export const actionItems = sqliteTable("action_items", {
  id: text("id").primaryKey(), meetingId: text("meeting_id").notNull().references(() => meetings.id), ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  title: text("title").notNull(), description: text("description"), dueAt: text("due_at"), status: text("status", { enum: ["open", "done", "cancelled"] }).notNull(),
  visibility: text("visibility").notNull(), createdByUserId: text("created_by_user_id").notNull().references(() => users.id), ...timestamps, completedAt: text("completed_at"),
});

export const meetingOutcomes = sqliteTable("meeting_outcomes", {
  id: text("id").primaryKey(), meetingId: text("meeting_id").notNull().references(() => meetings.id), kind: text("kind", { enum: ["recognition", "growth_opportunity", "summary"] }).notNull(),
  content: text("content").notNull(), visibility: text("visibility").notNull(), createdByUserId: text("created_by_user_id").notNull().references(() => users.id), ...timestamps,
});

export const emailJobs = sqliteTable("email_jobs", {
  id: text("id").primaryKey(), jobType: text("job_type").notNull(), cycleId: text("cycle_id").references(() => feedbackCycles.id), recipientUserId: text("recipient_user_id").notNull().references(() => users.id),
  scheduledFor: text("scheduled_for").notNull(), status: text("status", { enum: ["pending", "processing", "sent", "failed", "cancelled"] }).notNull(), attemptCount: integer("attempt_count").notNull().default(0),
  idempotencyKey: text("idempotency_key").notNull(), providerMessageId: text("provider_message_id"), lastErrorCode: text("last_error_code"), lastErrorAt: text("last_error_at"), ...timestamps, sentAt: text("sent_at"),
}, (table) => [uniqueIndex("email_jobs_idempotency_unique").on(table.idempotencyKey), index("email_jobs_due_idx").on(table.status, table.scheduledFor)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), occurredAt: text("occurred_at").notNull(), actorUserId: text("actor_user_id").references(() => users.id), action: text("action").notNull(),
  resourceType: text("resource_type").notNull(), resourceId: text("resource_id"), outcome: text("outcome").notNull(), reasonCode: text("reason_code"), requestId: text("request_id"), metadataJson: text("metadata_json"),
}, (table) => [index("audit_logs_occurred_idx").on(table.occurredAt)]);

export const schemaChecks = { minimumThreshold: sql`anonymity_threshold >= 3` };
