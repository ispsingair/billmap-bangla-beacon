import { describe, expect, it } from "vitest";
import { parseCoordinates } from "./coordinates";

describe("parseCoordinates", () => {
  it("accepts valid range bounds", () => expect(parseCoordinates("-90", "180")).toEqual({ lat: -90, lng: 180 }));
  it("rejects latitude outside -90..90", () => expect(parseCoordinates("90.1", "90")).toBeNull());
  it("rejects longitude outside -180..180", () => expect(parseCoordinates("23.8", "-180.5")).toBeNull());
  it("rejects blank or non-numeric", () => {
    expect(parseCoordinates("", "90")).toBeNull();
    expect(parseCoordinates("abc", "90")).toBeNull();
  });
});