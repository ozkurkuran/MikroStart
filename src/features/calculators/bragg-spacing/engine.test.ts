import { describe, expect, it } from "vitest";

import {
  CU_K_ALPHA_WAVELENGTH,
  calculateBragg,
  convertLength,
} from "./engine";

describe("calculateBragg", () => {
  it("calculates d-spacing for Cu Kα at 2θ = 20°", () => {
    const outcome = calculateBragg({
      solveFor: "dSpacing",
      wavelength: CU_K_ALPHA_WAVELENGTH,
      twoThetaDegrees: 20,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Hand-verifiable: 1.5406 / (2 sin(10°)) = 4.435980903... Å.
    expect(outcome.result.quantity).toBe("dSpacing");
    expect(outcome.result.value).toBeCloseTo(4.435980903, 9);
    expect(outcome.result.unit).toBe("angstrom");
    expect(outcome.provenance.normalizedInputs).toEqual({
      solveFor: "dSpacing",
      order: 1,
      wavelengthAngstrom: 1.5406,
      twoThetaDegrees: 20,
    });
  });

  it("calculates 2θ for d = 2 Å using Cu Kα radiation", () => {
    const outcome = calculateBragg({
      solveFor: "twoTheta",
      wavelength: CU_K_ALPHA_WAVELENGTH,
      dSpacing: { value: 2, unit: "angstrom" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Hand-verifiable: 2 asin(1.5406 / 4) = 45.30610552... degrees.
    expect(outcome.result.quantity).toBe("twoTheta");
    expect(outcome.result.value).toBeCloseTo(45.30610552, 8);
    expect(outcome.result.unit).toBe("degree");
  });

  it("preserves explicit nanometre units for the d-spacing result", () => {
    const outcome = calculateBragg({
      solveFor: "dSpacing",
      wavelength: { value: 0.15406, unit: "nm" },
      twoThetaDegrees: 60,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // sin(30°) = 0.5, so d equals λ exactly for this case.
    expect(outcome.result.value).toBeCloseTo(0.15406, 12);
    expect(outcome.result.unit).toBe("nm");
    expect(outcome.provenance.normalizedInputs.wavelengthAngstrom).toBeCloseTo(
      1.5406,
      12,
    );
  });

  it("accepts the exact first-order backscatter boundary", () => {
    const outcome = calculateBragg({
      solveFor: "twoTheta",
      wavelength: { value: 1, unit: "angstrom" },
      dSpacing: { value: 0.5, unit: "angstrom" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result.value).toBeCloseTo(180, 12);
    expect(outcome.warnings).toContainEqual(
      expect.objectContaining({ code: "BACKSCATTER_LIMIT" }),
    );
  });

  it("rejects a d-spacing with no real first-order solution", () => {
    const outcome = calculateBragg({
      solveFor: "twoTheta",
      wavelength: { value: 1.5406, unit: "angstrom" },
      dSpacing: { value: 0.7, unit: "angstrom" },
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;

    expect(outcome.errors).toContainEqual(
      expect.objectContaining({ code: "NO_PHYSICAL_SOLUTION" }),
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid wavelengths (%s)",
    (wavelength) => {
      const outcome = calculateBragg({
        solveFor: "dSpacing",
        wavelength: { value: wavelength, unit: "angstrom" },
        twoThetaDegrees: 30,
      });

      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.errors.some((error) => error.field === "wavelength")).toBe(
        true,
      );
    },
  );

  it.each([0, -1, 180.0001, Number.NaN])(
    "rejects invalid measured 2θ values (%s)",
    (twoThetaDegrees) => {
      const outcome = calculateBragg({
        solveFor: "dSpacing",
        wavelength: CU_K_ALPHA_WAVELENGTH,
        twoThetaDegrees,
      });

      expect(outcome.ok).toBe(false);
    },
  );

  it("returns warnings without changing a valid result", () => {
    const outcome = calculateBragg({
      solveFor: "dSpacing",
      wavelength: { value: 12, unit: "angstrom" },
      twoThetaDegrees: 0.5,
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.warnings.map((warning) => warning.code)).toEqual([
      "UNUSUAL_XRAY_WAVELENGTH",
      "LOW_ANGLE_SENSITIVITY",
    ]);
  });
});

describe("convertLength", () => {
  it("converts between ångströms and nanometres", () => {
    expect(convertLength(1, "nm", "angstrom")).toBe(10);
    expect(convertLength(10, "angstrom", "nm")).toBe(1);
  });
});
