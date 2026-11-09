// Response shapes of the Worker API (worker/index.ts, worker/coordinator.ts, worker/admin.ts).
import type { CurrentUser } from "./api";

export type RoleKey = CurrentUser["roles"][number];

export type EmployeeDashboardData = {
  team: null | { name: string; coordinatorName: string | null };
  answeredThisWeek: boolean;
  thisWeek: null | { cycleId: string; closesAt: string; signed: boolean };
  signedEvaluations: SignedEvaluation[];
  conversations: Conversation[];
  activeCycle: null | { id: string; opensAt: string; closesAt: string; teamName: string; coordinatorName: string; coordinatorAvatarUrl?: string };
  history: Array<{ cycleId: string; opensAt: string; status: "done" | "skipped" }>;
};

export type DimensionAverages = { coordinator: number; team: number; work: number };

export type CoordinatorTeam = {
  id: string;
  name: string;
  memberCount: number | null;
  isCurrent: boolean;
  openCycle: null | { cycleId: string; opensAt: string; closesAt: string; participantCount: number; threshold: number; thresholdReached: boolean };
  awaitingReport: null | { cycleId: string; closesAt: string; reportAt: string };
  latest: null
    | { cycleId: string; opensAt: string; closesAt: string; threshold: number; status: "ready"; responseCount: number; dimensions: DimensionAverages; comments: string[] }
    | { cycleId: string; opensAt: string; closesAt: string; threshold: number; status: "insufficient_responses" };
  history: Array<{ cycleId: string; opensAt: string; status: "ready" | "insufficient_responses" }>;
  complaints: CoordinatorComplaints;
};

export type CoordinatorComplaints = {
  signed: Array<{ id: string; weekStart: string; authorName: string; topics: string[]; body: string }>;
  anonymousWeeks: Array<{ weekStart: string; items: Array<{ id: string; topics: string[]; body: string }> }>;
  withheldWeeks: string[];
};

export type CoordinatorDashboardData = {
  nextCycle: null | { opensAt: string; closesAt: string };
  teams: CoordinatorTeam[];
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  roles: RoleKey[];
  teamId: string | null;
  status: "active" | "invited" | "invite_expired" | "inactive";
};

export type AdminTeam = { id: string; name: string; isActive: boolean; coordinatorUserId: string | null; memberCount: number };

export type SignedEvaluation = { cycleId: string; weekStart: string; coordinator: number; team: number; work: number; comment: string | null };
export type Conversation = { id: string; heldOn: string; coordinatorName: string; notes: string; updatedAt: string };
export type TeamPerson = { id: string; name: string; teamId: string; teamName: string; signedEvaluations: SignedEvaluation[]; conversations: Conversation[] };
