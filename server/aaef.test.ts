/**
 * aaef.test.ts — Tests for the AAEF (AI Agent Evaluation Framework) module
 *
 * Covers:
 *  - WAS (Weighted Aggregate Score) calculation
 *  - Rating mapping from WAS
 *  - Override condition detection
 *  - Mandatory response mapping
 *  - Default profile weights
 */

import { describe, expect, it } from "vitest";
import {
  calculateWAS,
  checkOverrides,
  DEFAULT_PROFILES,
  ratingToMandatoryResponse,
  wasToRating,
} from "./aaef";

// ─── WAS Calculation ──────────────────────────────────────────────────────────

describe("calculateWAS", () => {
  it("returns 5.00 when all scores are 5 with equal weights", () => {
    const scores = { d1: 5, d2: 5, d3: 5, d4: 5, d5: 5 };
    const weights = { w1: 0.25, w2: 0.25, w3: 0.20, w4: 0.20, w5: 0.10 };
    expect(calculateWAS(scores, weights)).toBe(5.0);
  });

  it("returns 1.00 when all scores are 1", () => {
    const scores = { d1: 1, d2: 1, d3: 1, d4: 1, d5: 1 };
    const weights = { w1: 0.25, w2: 0.25, w3: 0.20, w4: 0.20, w5: 0.10 };
    expect(calculateWAS(scores, weights)).toBe(1.0);
  });

  it("computes correct WAS for Profile A (Autonomous Decision-Making)", () => {
    // Profile A: w1=0.25, w2=0.30, w3=0.20, w4=0.15, w5=0.10
    const scores = { d1: 4, d2: 5, d3: 3, d4: 4, d5: 4 };
    const weights = { w1: 0.25, w2: 0.30, w3: 0.20, w4: 0.15, w5: 0.10 };
    // 4*0.25 + 5*0.30 + 3*0.20 + 4*0.15 + 4*0.10
    // = 1.00 + 1.50 + 0.60 + 0.60 + 0.40 = 4.10
    expect(calculateWAS(scores, weights)).toBeCloseTo(4.1, 2);
  });

  it("weights sum to 1.0 for all default profiles", () => {
    for (const profile of DEFAULT_PROFILES) {
      const sum = profile.w1 + profile.w2 + profile.w3 + profile.w4 + profile.w5;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it("rounds to 2 decimal places", () => {
    const scores = { d1: 3, d2: 4, d3: 2, d4: 5, d5: 3 };
    const weights = { w1: 0.25, w2: 0.25, w3: 0.20, w4: 0.20, w5: 0.10 };
    const was = calculateWAS(scores, weights);
    expect(was.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

// ─── Rating Mapping ───────────────────────────────────────────────────────────

describe("wasToRating", () => {
  it("maps WAS >= 4.5 to exemplary", () => {
    expect(wasToRating(4.5)).toBe("exemplary");
    expect(wasToRating(5.0)).toBe("exemplary");
  });

  it("maps WAS 3.5–4.49 to proficient", () => {
    expect(wasToRating(3.5)).toBe("proficient");
    expect(wasToRating(4.49)).toBe("proficient");
  });

  it("maps WAS 2.5–3.49 to developing", () => {
    expect(wasToRating(2.5)).toBe("developing");
    expect(wasToRating(3.49)).toBe("developing");
  });

  it("maps WAS 1.5–2.49 to at_risk", () => {
    expect(wasToRating(1.5)).toBe("at_risk");
    expect(wasToRating(2.49)).toBe("at_risk");
  });

  it("maps WAS < 1.5 to unacceptable", () => {
    expect(wasToRating(1.0)).toBe("unacceptable");
    expect(wasToRating(1.49)).toBe("unacceptable");
  });
});

// ─── Override Conditions ──────────────────────────────────────────────────────

describe("checkOverrides", () => {
  it("triggers override when D4 (compliance) score is 1 — immediate suspension", () => {
    const scores = { d1: 4, d2: 4, d3: 4, d4: 1, d5: 4 };
    const was = 3.8;
    const result = checkOverrides(scores, was, 0);
    expect(result.triggered).toBe(true);
    expect(result.reasons.some((r) => r.includes("D4"))).toBe(true);
  });

  it("triggers override when D4 (compliance) score is 1", () => {
    const scores = { d1: 4, d2: 4, d3: 4, d4: 1, d5: 4 };
    const result = checkOverrides(scores, 3.6, 0);
    expect(result.triggered).toBe(true);
  });

  it("triggers override when D3 score is 1 (escalation failure)", () => {
    const scores = { d1: 4, d2: 4, d3: 1, d4: 4, d5: 4 };
    const result = checkOverrides(scores, 3.7, 0);
    expect(result.triggered).toBe(true);
    expect(result.reasons.some((r) => r.includes("D3"))).toBe(true);
  });

  it("triggers override after 3 consecutive low WAS periods (consecutiveLowWas >= 2 AND was < 3.0)", () => {
    const scores = { d1: 2, d2: 2, d3: 3, d4: 3, d5: 3 };
    const result = checkOverrides(scores, 2.5, 2);
    expect(result.triggered).toBe(true);
    expect(result.reasons.some((r) => r.includes("consecutive"))).toBe(true);
  });

  it("does not trigger override for a healthy agent", () => {
    const scores = { d1: 4, d2: 4, d3: 4, d4: 4, d5: 4 };
    const result = checkOverrides(scores, 4.0, 0);
    expect(result.triggered).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("returns multiple reasons when multiple conditions are met", () => {
    const scores = { d1: 1, d2: 1, d3: 1, d4: 1, d5: 1 };
    const result = checkOverrides(scores, 1.0, 4);
    expect(result.triggered).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(1);
  });
});

// ─── Mandatory Response Mapping ───────────────────────────────────────────────

describe("ratingToMandatoryResponse", () => {
  it("returns a non-empty string for every rating", () => {
    const ratings = ["exemplary", "proficient", "developing", "at_risk", "unacceptable"] as const;
    for (const rating of ratings) {
      const response = ratingToMandatoryResponse(rating);
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    }
  });

  it("returns escalation language for unacceptable rating", () => {
    const response = ratingToMandatoryResponse("unacceptable");
    expect(response.toLowerCase()).toMatch(/suspend|immediate|escalat/);
  });

  it("returns recognition language for exemplary rating", () => {
    const response = ratingToMandatoryResponse("exemplary");
    expect(response.toLowerCase()).toMatch(/recogni|commend|document|best practice/);
  });
});

// ─── Default Profiles ─────────────────────────────────────────────────────────

describe("DEFAULT_PROFILES", () => {
  it("defines 6 profiles (default + A through E)", () => {
    expect(DEFAULT_PROFILES).toHaveLength(6);
    const codes = DEFAULT_PROFILES.map((p) => p.profileCode);
    expect(codes).toContain("default");
    expect(codes).toContain("A");
    expect(codes).toContain("E");
  });

  it("all profiles have distinct names", () => {
    const names = DEFAULT_PROFILES.map((p) => p.profileName);
    const unique = new Set(names);
    expect(unique.size).toBe(DEFAULT_PROFILES.length);
  });

  it("all weight values are between 0 and 1", () => {
    for (const p of DEFAULT_PROFILES) {
      expect(p.w1).toBeGreaterThan(0);
      expect(p.w1).toBeLessThanOrEqual(1);
      expect(p.w2).toBeGreaterThan(0);
      expect(p.w4).toBeGreaterThan(0);
      expect(p.w5).toBeGreaterThan(0);
    }
  });
});
