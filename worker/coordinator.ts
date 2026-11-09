import type { Env } from "./env";
import { requireRole } from "./access";
import { json } from "./http";
import { roundAverage, summarizeTeam, type CohortRow, type DimensionAverages } from "./domain/coordinator";

export async function handleCoordinatorDashboard(request: Request, env: Env): Promise<Response> {
  const user = await requireRole(request, env, "coordinator");
  const now = new Date().toISOString();

  // Cohort = cycle × team × this coordinator, from the immutable participant snapshot.
  const cohorts = await env.DB.prepare(`SELECT c.id AS cycleId, p.team_id AS teamId, t.name AS teamName,
      c.opens_at AS opensAt, c.closes_at AS closesAt, c.report_at AS reportAt, c.anonymity_threshold_snapshot AS threshold,
      COUNT(p.id) AS eligibleCount, COUNT(s.id) AS submittedCount
    FROM feedback_cycle_participants p
    JOIN feedback_cycles c ON c.id = p.cycle_id
    JOIN teams t ON t.id = p.team_id
    LEFT JOIN feedback_submissions s ON s.participant_id = p.id AND s.state = 'submitted'
    WHERE p.coordinator_user_id = ? AND p.eligibility_status = 'eligible' AND c.status != 'cancelled' AND c.opens_at <= ?
    GROUP BY c.id, p.team_id
    ORDER BY c.opens_at DESC
    LIMIT 200`).bind(user.id, now).all<CohortRow>();

  const currentTeams = await env.DB.prepare(`SELECT t.id, t.name,
      (SELECT COUNT(*) FROM team_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = t.id AND tm.ends_at IS NULL AND u.is_active = 1 AND tm.user_id != ?) AS memberCount
    FROM team_coordinators tc JOIN teams t ON t.id = tc.team_id
    WHERE tc.user_id = ? AND tc.ends_at IS NULL AND t.is_active = 1
    GROUP BY t.id ORDER BY t.name COLLATE NOCASE`).bind(user.id, user.id).all<{ id: string; name: string; memberCount: number }>();

  const nextCycle = await env.DB.prepare(`SELECT opens_at AS opensAt, closes_at AS closesAt FROM feedback_cycles
    WHERE status = 'scheduled' AND opens_at > ? ORDER BY opens_at LIMIT 1`).bind(now).first<{ opensAt: string; closesAt: string }>();

  const teamIds = [...new Set([...currentTeams.results.map((team) => team.id), ...cohorts.results.map((row) => row.teamId)])];
  const teams = await Promise.all(teamIds.map(async (teamId) => {
    const current = currentTeams.results.find((team) => team.id === teamId);
    const rows = cohorts.results.filter((row) => row.teamId === teamId);
    const summary = summarizeTeam(rows, now);
    const latest = summary.latestReported;
    let results: null | { responseCount: number; dimensions: DimensionAverages; comments: string[] } = null;
    if (latest?.ready && latest.responseCount) {
      const answers = await env.DB.prepare(`SELECT a.dimension, a.numeric_value AS numericValue, a.text_value AS textValue
        FROM feedback_answers a
        JOIN feedback_submissions s ON s.id = a.submission_id AND s.state = 'submitted'
        JOIN feedback_cycle_participants p ON p.id = s.participant_id
        WHERE p.cycle_id = ? AND p.team_id = ? AND p.coordinator_user_id = ? AND p.eligibility_status = 'eligible'
        ORDER BY a.id`).bind(latest.cycleId, teamId, user.id).all<{ dimension: keyof DimensionAverages; numericValue: number | null; textValue: string | null }>();
      const average = (dimension: keyof DimensionAverages) => {
        const values = answers.results.filter((answer) => answer.dimension === dimension && answer.numericValue !== null).map((answer) => Number(answer.numericValue));
        return values.length ? roundAverage(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      };
      results = {
        responseCount: latest.responseCount,
        dimensions: { coordinator: average("coordinator"), team: average("team"), work: average("work") },
        // Random answer ids give a stable order unrelated to submission time (docs/PRIVACY.md).
        comments: answers.results.flatMap((answer) => answer.textValue?.trim() ? [answer.textValue.trim()] : []),
      };
    }
    return {
      id: teamId,
      name: current?.name ?? rows[0]?.teamName ?? "",
      memberCount: current?.memberCount ?? null,
      isCurrent: Boolean(current),
      openCycle: summary.openCycle,
      awaitingReport: summary.awaitingReport,
      latest: latest ? (results
        ? { cycleId: latest.cycleId, opensAt: latest.opensAt, closesAt: latest.closesAt, threshold: latest.threshold, status: "ready" as const, ...results }
        : { cycleId: latest.cycleId, opensAt: latest.opensAt, closesAt: latest.closesAt, threshold: latest.threshold, status: "insufficient_responses" as const })
        : null,
      history: summary.history.slice(0, 12),
    };
  }));

  // Past teams without any reportable cycle add nothing for the coordinator.
  return json({ nextCycle: nextCycle ?? null, teams: teams.filter((team) => team.isCurrent || team.history.length || team.openCycle || team.awaitingReport) });
}
