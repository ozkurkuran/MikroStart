import { describe, expect, it } from "vitest";

import { calculateScherrer } from "./scherrer";

describe("calculateScherrer", () => {
  it("uses radians internally and applies the Scherrer equation", () => {
    const outcome = calculateScherrer({
      wavelength: { value: 1, unit: "nm" },
      fwhm: { value: 1, unit: "radian" },
      twoThetaDegrees: 120,
      shapeFactor: 1,
      instrumentalFwhm: { value: 0, unit: "radian" },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Oracle: cos(120° / 2) = 1/2, so D = 1 nm / (1 × 1/2) = 2 nm.
    expect(outcome.result.crystalliteSizeNanometres).toBeCloseTo(2, 12);
    expect(outcome.provenance.algorithmVersion).toBe("1.0.0");
    expect(outcome.provenance.sourceIds).toEqual(["IUCr:ScherrerEquation"]);
  });

  it("subtracts instrumental broadening in quadrature", () => {
    const outcome = calculateScherrer({
      wavelength: { value: 1, unit: "nm" },
      fwhm: { value: 0.05, unit: "radian" },
      instrumentalFwhm: { value: 0.03, unit: "radian" },
      twoThetaDegrees: 120,
      shapeFactor: 1,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Oracle: sqrt(0.05² - 0.03²) = 0.04; D = 1 nm/(0.04×0.5)=50 nm.
    expect(outcome.result.correctedFwhmRadians).toBeCloseTo(0.04, 15);
    expect(outcome.result.crystalliteSizeNanometres).toBeCloseTo(50, 12);
  });

  it("rejects an instrument width not smaller than the observed width", () => {
    const outcome = calculateScherrer({
      wavelength: { value: 1.5406, unit: "angstrom" },
      fwhm: { value: 0.1, unit: "degree" },
      instrumentalFwhm: { value: 0.1, unit: "degree" },
      twoThetaDegrees: 40,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors).toContainEqual(
      expect.objectContaining({ code: "INSTRUMENT_BROADENING_TOO_LARGE" }),
    );
  });
});

