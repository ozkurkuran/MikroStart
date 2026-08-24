import { describe, expect, it } from "vitest";

import {
  calculateSheetResistance,
  FOUR_POINT_PROBE_GEOMETRY_FACTOR,
} from "./sheet-resistance";

describe("calculateSheetResistance", () => {
  it("applies π/ln(2) and converts optional thickness to metres", () => {
    const outcome = calculateSheetResistance({
      voltage: { value: 1, unit: "mV" },
      current: { value: 1, unit: "mA" },
      thickness: { value: 100, unit: "nm" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Oracle: V/I = 1 Ω, Rs = π/ln(2) Ω/□ and ρ = Rs × 10⁻⁷ m.
    expect(outcome.result.sheetResistanceOhmsPerSquare).toBeCloseTo(
      Math.PI / Math.log(2),
      14,
    );
    expect(outcome.result.resistivityOhmMetres).toBeCloseTo(
      FOUR_POINT_PROBE_GEOMETRY_FACTOR * 1e-7,
      18,
    );
    expect(outcome.result.resistivityOhmCentimetres).toBeCloseTo(
      FOUR_POINT_PROBE_GEOMETRY_FACTOR * 1e-5,
      16,
    );
  });

  it("uses magnitude while retaining a polarity warning", () => {
    const outcome = calculateSheetResistance({
      voltage: { value: -2, unit: "V" },
      current: { value: 1, unit: "A" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.sheetResistanceOhmsPerSquare).toBeCloseTo(
      2 * Math.PI / Math.log(2),
      14,
    );
    expect(outcome.warnings).toContainEqual(
      expect.objectContaining({ code: "POLARITY_IGNORED" }),
    );
  });

  it("rejects zero current and invalid thickness", () => {
    const outcome = calculateSheetResistance({
      voltage: { value: 1, unit: "V" },
      current: { value: 0, unit: "A" },
      thickness: { value: -1, unit: "nm" },
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((error) => error.field)).toEqual([
      "current",
      "thickness",
    ]);
  });
});

