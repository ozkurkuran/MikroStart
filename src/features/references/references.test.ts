import { describe, expect, it } from "vitest";

import {
  CODATA_CONSTANTS,
  E_SERIES,
  PERIODIC_ELEMENTS,
  atomicWeightCentralValue,
  getElement,
  getPhysicalConstant,
  nearestESeriesValue,
  searchReferences,
  valuesForDecade,
} from ".";

describe("bundled reference data", () => {
  it("contains 118 sequential, uniquely named elements", () => {
    expect(PERIODIC_ELEMENTS).toHaveLength(118);
    expect(PERIODIC_ELEMENTS.map((element) => element.atomicNumber)).toEqual(
      Array.from({ length: 118 }, (_, index) => index + 1),
    );
    expect(new Set(PERIODIC_ELEMENTS.map((element) => element.symbol)).size).toBe(118);
    expect(new Set(PERIODIC_ELEMENTS.map((element) => element.name)).size).toBe(118);
    expect(getElement(79)?.symbol).toBe("Au");
    expect(getElement("aluminium")?.atomicNumber).toBe(13);
  });

  it("does not invent standard weights for elements without one", () => {
    expect(getElement("Tc")?.standardAtomicWeight).toBeNull();
    expect(getElement("Og")?.standardAtomicWeight).toBeNull();
    expect(atomicWeightCentralValue(getElement("Zr")!)).toBeCloseTo(91.222, 6);
  });

  it("keeps CODATA identifiers and finite computational values unique", () => {
    expect(new Set(CODATA_CONSTANTS.map((constant) => constant.id)).size).toBe(
      CODATA_CONSTANTS.length,
    );
    expect(CODATA_CONSTANTS.every((constant) => Number.isFinite(constant.value))).toBe(true);
    expect(getPhysicalConstant("h")?.value).toBe(6.626_070_15e-34);
  });
});

describe("reference search", () => {
  it("finds constants by alias and elements by symbol or atomic number", () => {
    expect(searchReferences("ideal gas")[0]).toMatchObject({
      kind: "constant",
      item: { id: "molar-gas-constant" },
    });
    expect(searchReferences("Fe")[0]).toMatchObject({
      kind: "element",
      item: { atomicNumber: 26 },
    });
    expect(searchReferences("79")[0]).toMatchObject({
      kind: "element",
      item: { symbol: "Au" },
    });
  });

  it("limits results and handles blank input without dumping the dataset", () => {
    expect(searchReferences("")).toEqual([]);
    expect(searchReferences("metal", { limit: 3 })).toHaveLength(3);
  });
});

describe("E-series utilities", () => {
  it("preserves the defined number of values per decade", () => {
    expect(E_SERIES.E6.values).toHaveLength(6);
    expect(E_SERIES.E12.values).toHaveLength(12);
    expect(E_SERIES.E24.values).toHaveLength(24);
  });

  it("scales preferred values by decimal decade", () => {
    expect(valuesForDecade("E6", 3)).toEqual([1_000, 1_500, 2_200, 3_300, 4_700, 6_800]);
    expect(valuesForDecade("E12", -1)[1]).toBeCloseTo(0.12, 12);
  });

  it("finds the nearest preferred value across a decade boundary", () => {
    expect(nearestESeriesValue(4_620, "E24")).toBe(4_700);
    expect(nearestESeriesValue(9.8, "E6")).toBe(10);
    expect(() => nearestESeriesValue(0, "E12")).toThrow(RangeError);
  });
});
