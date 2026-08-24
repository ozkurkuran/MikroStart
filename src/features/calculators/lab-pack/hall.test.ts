import { describe, expect, it } from "vitest";

import { calculateHall, ELEMENTARY_CHARGE_COULOMBS } from "./hall";

describe("calculateHall", () => {
  it("calculates signed Hall coefficient, density and mobility", () => {
    const outcome = calculateHall({
      current: { value: 1, unit: "A" },
      magneticField: { value: 2, unit: "T" },
      thickness: { value: 3, unit: "m" },
      hallVoltage: { value: 4, unit: "V" },
      sheetResistanceOhmsPerSquare: 5,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Oracles: RH = 4×3/(1×2)=6 m³/C; ρ=5×3=15 Ωm; μ=6/15=0.4 m²/Vs.
    expect(outcome.result.hallCoefficientCubicMetresPerCoulomb).toBe(6);
    expect(outcome.result.carrierDensityPerCubicMetre).toBeCloseTo(
      1 / (6 * ELEMENTARY_CHARGE_COULOMBS),
      0,
    );
    expect(outcome.result.bulkResistivityOhmMetres).toBe(15);
    expect(outcome.result.mobilitySquareMetresPerVoltSecond).toBeCloseTo(
      0.4,
      15,
    );
    expect(outcome.result.conventionalDominantCarrier).toBe("hole");
  });

  it("normalizes lab units and preserves the Hall sign", () => {
    const outcome = calculateHall({
      current: { value: 10, unit: "mA" },
      magneticField: { value: 500, unit: "mT" },
      thickness: { value: 100, unit: "nm" },
      hallVoltage: { value: -2, unit: "mV" },
      sheetResistanceOhmsPerSquare: 100,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // RH = -0.002×10⁻⁷/(0.01×0.5) = -4×10⁻⁸ m³/C.
    expect(outcome.result.hallCoefficientCubicMetresPerCoulomb).toBeCloseTo(
      -4e-8,
      20,
    );
    expect(outcome.result.mobilitySquareCentimetresPerVoltSecond).toBeCloseTo(
      40,
      12,
    );
    expect(outcome.result.conventionalDominantCarrier).toBe("electron");
  });

  it("rejects zero field and non-positive sheet resistance", () => {
    const outcome = calculateHall({
      current: { value: 1, unit: "mA" },
      magneticField: { value: 0, unit: "T" },
      thickness: { value: 100, unit: "nm" },
      hallVoltage: { value: 1, unit: "uV" },
      sheetResistanceOhmsPerSquare: 0,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((error) => error.field)).toEqual([
      "magneticField",
      "sheetResistance",
    ]);
  });
});

