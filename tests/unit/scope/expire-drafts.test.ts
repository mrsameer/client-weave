import { describe, expect, it } from "vitest";
import {
  deleteRetainedFinalizedScopes,
  expireDrafts
} from "../../../src/modules/scope/application/expire-drafts";

describe("expireDrafts", () => {
  it("expires only unfinalized scopes supplied by the durable repository", async () => {
    const expired: string[] = [];
    const now = new Date("2026-01-31T00:00:00Z");
    const count = await expireDrafts(
      {
        findExpiredDrafts: async () => [
          { id: "draft", expiresAt: new Date("2026-01-30T00:00:00Z") }
        ],
        expireAndRevoke: async (id) => {
          expired.push(id);
        }
      },
      now
    );
    expect(count).toBe(1);
    expect(expired).toEqual(["draft"]);
  });
});

describe("deleteRetainedFinalizedScopes", () => {
  it("deletes only finalized scopes selected by the workspace retention policy", async () => {
    const deleted: string[] = [];
    const count = await deleteRetainedFinalizedScopes(
      {
        findFinalizedPastRetention: async () => [
          { id: "finalized-a", workspaceId: "workspace-a" },
          { id: "finalized-b", workspaceId: "workspace-b" }
        ],
        deleteFinalizedForRetention: async (scope) => {
          deleted.push(`${scope.workspaceId}:${scope.id}`);
        }
      },
      new Date("2026-01-31T00:00:00Z")
    );
    expect(count).toBe(2);
    expect(deleted).toEqual(["workspace-a:finalized-a", "workspace-b:finalized-b"]);
  });
});
