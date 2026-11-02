import { describe, expect, it } from "vitest";
import { customerStatus, directionsUrl, formatBDT } from "./billing";

describe("billing rules", () => {
  it("is paid when nothing is due", () => {
    expect(customerStatus(0, "2026-10-01", "2026-11-02")).toBe("paid");
  });
  it("is unpaid when due and the due date has not passed", () => {
    expect(customerStatus(800, "2026-11-10", "2026-11-02")).toBe("unpaid");
  });
  it("is overdue when due and the due date has passed", () => {
    expect(customerStatus(800, "2026-10-10", "2026-11-02")).toBe("overdue");
  });
  it("formats BDT", () => {
    expect(formatBDT(125000)).toBe("৳1,25,000");
  });
  it("directions use only the customer's coordinates", () => {
    const url = directionsUrl(23.8, 90.36);
    expect(url).toContain("destination=23.8,90.36");
    expect(url).not.toContain("origin=");
  });
});
