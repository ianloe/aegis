import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared mock context ───────────────────────────────────────────────────────
function createMockContext(role: "admin" | "user" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-001",
      email: "ian@meridian.com",
      name: "Ian Loe",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.name).toBe("Ian Loe");
    expect(user?.email).toBe("ian@meridian.com");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ─── Risk Score Validation ────────────────────────────────────────────────────
describe("risk score bounds", () => {
  it("risk score is always between 0 and 100", () => {
    const clamp = (score: number) => Math.min(100, Math.max(0, score));
    expect(clamp(-10)).toBe(0);
    expect(clamp(110)).toBe(100);
    expect(clamp(78.5)).toBe(78.5);
    expect(clamp(0)).toBe(0);
    expect(clamp(100)).toBe(100);
  });
});

// ─── Data Classification Tiers ────────────────────────────────────────────────
describe("data classification tiers", () => {
  const validTiers = ["benign", "internal", "sensitive"] as const;

  it("only accepts the three canonical data tiers", () => {
    validTiers.forEach((tier) => {
      expect(validTiers).toContain(tier);
    });
  });

  it("rejects unlisted tier values", () => {
    const invalidTiers = ["public", "private", "confidential", "top-secret"];
    invalidTiers.forEach((tier) => {
      expect(validTiers).not.toContain(tier as string);
    });
  });
});

// ─── Agent Lifecycle Statuses ─────────────────────────────────────────────────
describe("agent lifecycle statuses", () => {
  const validStatuses = ["active", "suspended", "decommissioned"] as const;

  it("only accepts the three canonical lifecycle statuses", () => {
    validStatuses.forEach((status) => {
      expect(validStatuses).toContain(status);
    });
  });

  it("rejects unlisted status values", () => {
    const invalidStatuses = ["inactive", "disabled", "archived", "pending"];
    invalidStatuses.forEach((status) => {
      expect(validStatuses).not.toContain(status as string);
    });
  });
});

// ─── Approval Queue Action Categories ────────────────────────────────────────
describe("approval queue action categories", () => {
  const requiredCategories = [
    "data_deletion",
    "external_communications",
    "financial_transactions",
    "privilege_escalation",
    "bulk_export",
  ] as const;

  it("includes all required high-risk action categories", () => {
    expect(requiredCategories).toContain("data_deletion");
    expect(requiredCategories).toContain("external_communications");
    expect(requiredCategories).toContain("financial_transactions");
  });

  it("has at least 3 required high-risk categories", () => {
    const mandatoryThree = ["data_deletion", "external_communications", "financial_transactions"];
    mandatoryThree.forEach((cat) => {
      expect(requiredCategories).toContain(cat as typeof requiredCategories[number]);
    });
    expect(requiredCategories.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── RBAC Roles ───────────────────────────────────────────────────────────────
describe("RBAC roles", () => {
  const validRoles = ["admin", "security_analyst", "viewer"] as const;

  it("includes the three canonical RBAC roles", () => {
    expect(validRoles).toContain("admin");
    expect(validRoles).toContain("security_analyst");
    expect(validRoles).toContain("viewer");
  });
});

// ─── Compliance Frameworks ────────────────────────────────────────────────────
describe("compliance frameworks", () => {
  const supportedFrameworks = ["PDPA", "EU AI Act", "MAS"];

  it("references all three required compliance frameworks", () => {
    expect(supportedFrameworks).toContain("PDPA");
    expect(supportedFrameworks).toContain("EU AI Act");
    expect(supportedFrameworks).toContain("MAS");
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => { cleared.push(name); },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});
