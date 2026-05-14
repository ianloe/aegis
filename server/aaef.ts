/**
 * server/aaef.ts — AI Agent Evaluation Framework (AAEF) v1.0
 *
 * Implements the full AAEF scoring model by Ian Loe:
 *   - Five evaluation dimensions (D1–D5)
 *   - Weighted Aggregate Score (WAS) calculation
 *   - Override condition detection
 *   - Performance profile management
 *   - Appraisal records and improvement plans
 */

import { getDb } from "./db";
import {
  aaefAppraisals,
  aaefImprovementPlans,
  aaefProfiles,
  agents,
  type AaefAppraisal,
  type AaefImprovementPlan,
  type AaefProfile,
} from "../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

// ─── Default AAEF Performance Profiles ───────────────────────────────────────

export const DEFAULT_PROFILES = [
  {
    profileCode: "default",
    profileName: "Default — General Operational Agent",
    description: "Balanced weights for a general-purpose deployed agent.",
    w1: 0.25, w2: 0.25, w3: 0.20, w4: 0.20, w5: 0.10,
  },
  {
    profileCode: "A",
    profileName: "Profile A — Customer-Facing Service Agent",
    description: "Elevated judgement and user experience weights. Applies to agents interacting directly with customers or external stakeholders.",
    w1: 0.20, w2: 0.30, w3: 0.20, w4: 0.15, w5: 0.15,
  },
  {
    profileCode: "B",
    profileName: "Profile B — Compliance and Regulatory Agent",
    description: "Elevated constraint compliance weight. Applies to agents in regulated contexts, handling sensitive data, or producing outputs with legal consequences.",
    w1: 0.25, w2: 0.20, w3: 0.20, w4: 0.30, w5: 0.05,
  },
  {
    profileCode: "C",
    profileName: "Profile C — Internal Operations and Process Agent",
    description: "Elevated task completion and escalation weights. Applies to agents handling internal workflows: procurement, IT operations, HR, finance.",
    w1: 0.35, w2: 0.20, w3: 0.25, w4: 0.15, w5: 0.05,
  },
  {
    profileCode: "D",
    profileName: "Profile D — Research and Analysis Agent",
    description: "Elevated judgement weight (40%). Applies to agents producing research outputs, summaries, or analytical content for human decision-makers.",
    w1: 0.20, w2: 0.40, w3: 0.20, w4: 0.15, w5: 0.05,
  },
  {
    profileCode: "E",
    profileName: "Profile E — Orchestrator and Multi-Agent Coordinator",
    description: "Custom weights required. Applies to agents coordinating other agents or managing task routing in multi-agent systems. Requires Domain Owner and Technology Owner approval.",
    w1: 0.25, w2: 0.25, w3: 0.20, w4: 0.20, w5: 0.10,
  },
] as const;

// ─── WAS Calculator ───────────────────────────────────────────────────────────

export interface DimensionScores {
  d1: number; // Task Completion and Accuracy
  d2: number; // Quality of Judgement
  d3: number; // Escalation Behaviour
  d4: number; // Process and Constraint Compliance
  d5: number; // User Experience and Trust
}

export interface ProfileWeights {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
}

export function calculateWAS(scores: DimensionScores, weights: ProfileWeights): number {
  const was =
    scores.d1 * weights.w1 +
    scores.d2 * weights.w2 +
    scores.d3 * weights.w3 +
    scores.d4 * weights.w4 +
    scores.d5 * weights.w5;
  return Math.round(was * 100) / 100;
}

export type OverallRating = "exemplary" | "proficient" | "developing" | "at_risk" | "unacceptable";

export function wasToRating(was: number): OverallRating {
  if (was >= 4.5) return "exemplary";
  if (was >= 3.5) return "proficient";
  if (was >= 2.5) return "developing";
  if (was >= 1.5) return "at_risk";
  return "unacceptable";
}

export interface OverrideCheck {
  triggered: boolean;
  reasons: string[];
}

export function checkOverrides(scores: DimensionScores, was: number, consecutiveLowWas: number): OverrideCheck {
  const reasons: string[] = [];

  // D4 score of 1 — immediate suspension pending review
  if (scores.d4 === 1) {
    reasons.push("D4 score of 1 (constraint compliance): immediate agent suspension pending formal review, regardless of WAS.");
  }

  // D3 score of 1 — immediate audit of all cases
  if (scores.d3 === 1) {
    reasons.push("D3 score of 1 (escalation behaviour): immediate audit of all cases handled without escalation during the review period.");
  }

  // Three consecutive periods with WAS below 3.0
  if (consecutiveLowWas >= 2 && was < 3.0) {
    // This is the third consecutive period
    reasons.push("Three consecutive appraisal periods with WAS below 3.0: mandatory retirement evaluation triggered.");
  }

  return { triggered: reasons.length > 0, reasons };
}

export function ratingToMandatoryResponse(rating: OverallRating): string {
  switch (rating) {
    case "exemplary":
      return "Document as benchmark. Share as positive example. Continuous optimisation only.";
    case "proficient":
      return "Maintain. Record minor issues for improvement tracking. At least one enhancement action per period.";
    case "developing":
      return "Structured Improvement Plan required within 5 business days. 15-day check-in. Reassess at 30 days.";
    case "at_risk":
      return "Immediate improvement plan. Enhanced monitoring. Bi-weekly check-ins. 60-day reassessment with consequence if not resolved.";
    case "unacceptable":
      return "Immediate escalation to strategic tier. Assess suspension need. Retirement evaluation within 10 business days.";
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

export async function ensureDefaultProfiles(tenantId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ profileCode: aaefProfiles.profileCode })
    .from(aaefProfiles)
    .where(eq(aaefProfiles.tenantId, tenantId));

  const existingCodes = new Set(existing.map((p: { profileCode: string }) => p.profileCode));

  for (const profile of DEFAULT_PROFILES) {
    if (!existingCodes.has(profile.profileCode)) {
      await db.insert(aaefProfiles).values({
        tenantId,
        profileCode: profile.profileCode,
        profileName: profile.profileName,
        description: profile.description,
        w1TaskCompletion: String(profile.w1),
        w2Judgement: String(profile.w2),
        w3Escalation: String(profile.w3),
        w4Compliance: String(profile.w4),
        w5UserExperience: String(profile.w5),
        isDefault: profile.profileCode === "default",
      });
    }
  }
}

export async function getProfiles(tenantId: number): Promise<AaefProfile[]> {
  await ensureDefaultProfiles(tenantId);
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aaefProfiles)
    .where(eq(aaefProfiles.tenantId, tenantId))
    .orderBy(asc(aaefProfiles.profileCode));
}

export async function getAppraisalsForAgent(
  tenantId: number,
  agentId: number
): Promise<AaefAppraisal[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aaefAppraisals)
    .where(
      and(
        eq(aaefAppraisals.tenantId, tenantId),
        eq(aaefAppraisals.agentId, agentId)
      )
    )
    .orderBy(desc(aaefAppraisals.appraisalDate));
}

export async function getAppraisalById(
  tenantId: number,
  appraisalId: number
): Promise<AaefAppraisal | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(aaefAppraisals)
    .where(
      and(
        eq(aaefAppraisals.tenantId, tenantId),
        eq(aaefAppraisals.id, appraisalId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createAppraisal(data: {
  tenantId: number;
  agentId: number;
  profileId: number;
  periodStart: Date;
  periodEnd: Date;
  appraisalDate: Date;
  conductedBy: string;
  d1Score: number;
  d2Score: number;
  d3Score: number;
  d4Score: number;
  d5Score: number;
  d1Rationale?: string;
  d2Rationale?: string;
  d3Rationale?: string;
  d4Rationale?: string;
  d5Rationale?: string;
  quantitativeDataSummary?: string;
  nextAppraisalDate?: Date;
  consecutiveLowWas: number;
}): Promise<AaefAppraisal> {
  // Fetch profile weights
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const profileRows = await db
    .select()
    .from(aaefProfiles)
    .where(eq(aaefProfiles.id, data.profileId))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) throw new Error("AAEF profile not found");

  const weights: ProfileWeights = {
    w1: Number(profile.w1TaskCompletion),
    w2: Number(profile.w2Judgement),
    w3: Number(profile.w3Escalation),
    w4: Number(profile.w4Compliance),
    w5: Number(profile.w5UserExperience),
  };

  const scores: DimensionScores = {
    d1: data.d1Score,
    d2: data.d2Score,
    d3: data.d3Score,
    d4: data.d4Score,
    d5: data.d5Score,
  };

  const was = calculateWAS(scores, weights);
  const rating = wasToRating(was);
  const overrides = checkOverrides(scores, was, data.consecutiveLowWas);
  const improvementPlanRequired = ["developing", "at_risk", "unacceptable"].includes(rating);

  const [result] = await db.insert(aaefAppraisals).values({
    tenantId: data.tenantId,
    agentId: data.agentId,
    profileId: data.profileId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    appraisalDate: data.appraisalDate,
    conductedBy: data.conductedBy,
    d1Score: data.d1Score,
    d2Score: data.d2Score,
    d3Score: data.d3Score,
    d4Score: data.d4Score,
    d5Score: data.d5Score,
    d1Rationale: data.d1Rationale,
    d2Rationale: data.d2Rationale,
    d3Rationale: data.d3Rationale,
    d4Rationale: data.d4Rationale,
    d5Rationale: data.d5Rationale,
    was: String(was),
    overallRating: rating,
    overrideTriggered: overrides.triggered,
    overrideReason: overrides.reasons.join(" | ") || null,
    improvementPlanRequired,
    quantitativeDataSummary: data.quantitativeDataSummary,
    nextAppraisalDate: data.nextAppraisalDate,
  });

  const newId = (result as any).insertId as number;

  // Update the agent's AAEF summary columns so the registry always shows the latest state
  const newConsecutiveLow = was < 3.0 ? data.consecutiveLowWas + 1 : 0;
  await db
    .update(agents)
    .set({
      aaefWas: String(was),
      aaefRating: rating,
      consecutiveLowWas: newConsecutiveLow,
      nextAppraisalDate: data.nextAppraisalDate ?? null,
    })
    .where(and(eq(agents.id, data.agentId), eq(agents.tenantId, data.tenantId)));

  const created = await getAppraisalById(data.tenantId, newId);
  return created!;
}

export async function getImprovementPlans(
  tenantId: number,
  agentId: number
): Promise<AaefImprovementPlan[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aaefImprovementPlans)
    .where(
      and(
        eq(aaefImprovementPlans.tenantId, tenantId),
        eq(aaefImprovementPlans.agentId, agentId)
      )
    )
    .orderBy(asc(aaefImprovementPlans.dueDate));
}

export async function createImprovementPlan(data: {
  tenantId: number;
  appraisalId: number;
  agentId: number;
  dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "overall";
  actionDescription: string;
  rootCause?: string;
  successCriteria?: string;
  owner: string;
  dueDate: Date;
  checkInDate?: Date;
}): Promise<AaefImprovementPlan> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(aaefImprovementPlans).values(data);
  const newId = (result as any).insertId as number;
  const rows = await db
    .select()
    .from(aaefImprovementPlans)
    .where(eq(aaefImprovementPlans.id, newId))
    .limit(1);
  return rows[0]!;
}

export async function updateImprovementPlanStatus(
  tenantId: number,
  planId: number,
  status: "open" | "in_progress" | "completed" | "overdue" | "escalated",
  completionNote?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(aaefImprovementPlans)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : undefined,
      completionNote: completionNote ?? undefined,
    })
    .where(
      and(
        eq(aaefImprovementPlans.tenantId, tenantId),
        eq(aaefImprovementPlans.id, planId)
      )
    );
}

export async function getAaefDashboardStats(tenantId: number) {
  const db = await getDb();
  if (!db) return { ratingCounts: [], overrideCount: 0, openPlanCount: 0, recentAppraisals: [] };
  // Count appraisals by rating
  const ratingCounts = await db
    .select({
      rating: aaefAppraisals.overallRating,
      count: sql<number>`count(*)`,
    })
    .from(aaefAppraisals)
    .where(eq(aaefAppraisals.tenantId, tenantId))
    .groupBy(aaefAppraisals.overallRating);

  // Count active override conditions
  const overrideCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(aaefAppraisals)
    .where(
      and(
        eq(aaefAppraisals.tenantId, tenantId),
        eq(aaefAppraisals.overrideTriggered, true)
      )
    );

  // Count open improvement plan actions
  const openPlans = await db
    .select({ count: sql<number>`count(*)` })
    .from(aaefImprovementPlans)
    .where(
      and(
        eq(aaefImprovementPlans.tenantId, tenantId),
        eq(aaefImprovementPlans.status, "open")
      )
    );

  // Latest appraisals per agent (most recent 10)
  const recentAppraisals = await db
    .select({
      id: aaefAppraisals.id,
      agentId: aaefAppraisals.agentId,
      agentName: agents.name,
      was: aaefAppraisals.was,
      overallRating: aaefAppraisals.overallRating,
      overrideTriggered: aaefAppraisals.overrideTriggered,
      appraisalDate: aaefAppraisals.appraisalDate,
    })
    .from(aaefAppraisals)
    .leftJoin(agents, eq(agents.id, aaefAppraisals.agentId))
    .where(eq(aaefAppraisals.tenantId, tenantId))
    .orderBy(desc(aaefAppraisals.appraisalDate))
    .limit(10);

  return {
    ratingCounts,
    overrideCount: Number(overrideCount[0]?.count ?? 0),
    openPlanCount: Number(openPlans[0]?.count ?? 0),
    recentAppraisals,
  };
}
