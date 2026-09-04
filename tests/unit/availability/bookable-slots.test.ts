import { describe, expect, it } from "vitest";
import { findBookableSlots } from "../../../src/modules/availability/domain/bookable-slots";

describe("findBookableSlots", () => {
  it("returns only future available service-compatible slots without reserving them", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const result = findBookableSlots(
      [
        {
          id: "blocked",
          startsAt: new Date("2026-01-01T11:00:00Z"),
          endsAt: new Date("2026-01-01T12:00:00Z"),
          status: "BLOCKED"
        },
        {
          id: "bookable",
          startsAt: new Date("2026-01-01T13:00:00Z"),
          endsAt: new Date("2026-01-01T14:00:00Z"),
          status: "AVAILABLE",
          serviceIds: ["service"]
        }
      ],
      "service",
      now
    );
    expect(result.map((slot) => slot.id)).toEqual(["bookable"]);
  });
});
