import { describe, expect, it } from "vitest";
import { errorMessage } from "../lib/client-errors";

describe("actionable client errors", () => {
  it("preserves a safe application message", () => {
    expect(errorMessage(new Error("Please sign in to continue."))).toBe("Please sign in to continue.");
  });
  it("does not expose unrecognized object data", () => {
    expect(errorMessage({ token: "private" })).toBe("Something went wrong. Please try again.");
  });
});
