import { describe, expect, it } from "vitest";
import {
  createScopeCapability,
  createScopeSessionSecret,
  hashScopeSecret,
  verifyScopeSecret
} from "../../../src/server/auth/scope-capability";
import {
  requireScopeAccess,
  ScopeAccessDenied
} from "../../../src/server/authorization/scope-access";
import {
  requireWorkspaceOwner,
  WorkspaceAccessDenied
} from "../../../src/server/authorization/workspace-access";

describe("scope capabilities", () => {
  it("hashes opaque one-scope secrets and rejects expired access", () => {
    const capability = createScopeCapability();
    const hash = hashScopeSecret(
      capability.secret,
      "a sufficiently long pepper used only for test values"
    );
    expect(
      verifyScopeSecret(
        capability.secret,
        "a sufficiently long pepper used only for test values",
        hash
      )
    ).toBe(true);
    expect(
      verifyScopeSecret("wrong", "a sufficiently long pepper used only for test values", hash)
    ).toBe(false);
    expect(() =>
      requireScopeAccess({ scopeId: "scope", expiresAt: new Date(0), revokedAt: null })
    ).toThrow(ScopeAccessDenied);
  });

  it("uses indistinguishable authorization failures for owner access", () => {
    expect(() => requireWorkspaceOwner(null, "workspace")).toThrow(WorkspaceAccessDenied);
    expect(
      requireWorkspaceOwner(
        { workspaceId: "workspace", role: "OWNER", status: "ACTIVE" },
        "workspace"
      ).workspaceId
    ).toBe("workspace");
  });

  it("uses distinct opaque material for a browser scope session", () => {
    expect(createScopeSessionSecret()).toHaveLength(43);
    expect(createScopeSessionSecret()).not.toBe(createScopeSessionSecret());
  });
});
