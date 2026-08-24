import { describe, expect, it } from "vitest";

import {
  ASSUMED_MONOLAYER_DENSITY_PER_SQUARE_METRE,
  BOLTZMANN_CONSTANT_JOULES_PER_KELVIN,
  calculateVacuum,
} from "./vacuum";

describe("calculateVacuum", () => {
  it("evaluates the hard-sphere and impingement equations in SI", () => {
    const outcome = calculateVacuum({
      pressure: { value: 1, unit: "Pa" },
      temperature: {
        value: 1 / BOLTZMANN_CONSTANT_JOULES_PER_KELVIN,
        unit: "K",
      },
      molecularDiameter: { value: 1, unit: "m" },
      molecularMass: { value: 1, unit: "kg" },
      stickingCoefficient: 1,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // With kT=p=d=m=S=1: λ=1/(sqrt(2)π), Z=1/sqrt(2π), τ=N sqrt(2π).
    expect(outcome.result.meanFreePathMetres).toBeCloseTo(
      1 / (Math.sqrt(2) * Math.PI),
      15,
    );
    expect(outcome.result.impingementRatePerSquareMetreSecond).toBeCloseTo(
      1 / Math.sqrt(2 * Math.PI),
      15,
    );
    expect(outcome.result.monolayerFormationTimeSeconds).toBeCloseTo(
      ASSUMED_MONOLAYER_DENSITY_PER_SQUARE_METRE * Math.sqrt(2 * Math.PI),
      -4,
    );
  });

  it("converts common vacuum units before calculating", () => {
    const outcome = calculateVacuum({
      pressure: { value: 1e-6, unit: "mbar" },
      temperature: { value: 26.85, unit: "degC" },
      molecularDiameter: { value: 3.7, unit: "angstrom" },
      molecularMass: { value: 28.0134, unit: "u" },
      stickingCoefficient: 1,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.provenance.normalizedInputs.pressurePascals).toBeCloseTo(
      1e-4,
      16,
    );
    expect(outcome.provenance.normalizedInputs.temperatureKelvin).toBeCloseTo(
      300,
      12,
    );
    expect(outcome.provenance.normalizedInputs.molecularDiameterMetres).toBeCloseTo(
      3.7e-10,
      21,
    );
  });

  it("rejects nonphysical temperature and sticking coefficient", () => {
    const outcome = calculateVacuum({
      pressure: { value: 1, unit: "Pa" },
      temperature: { value: -273.15, unit: "degC" },
      molecularDiameter: { value: 0.37, unit: "nm" },
      molecularMass: { value: 28, unit: "u" },
      stickingCoefficient: 1.1,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((error) => error.field)).toEqual([
      "temperature",
      "stickingCoefficient",
    ]);
  });
});

