import type { CalculatorSource } from "./shared";

export const SCHERRER_SOURCE = Object.freeze({
  id: "IUCr:ScherrerEquation",
  title: "Scherrer equation",
  publisher: "International Union of Crystallography",
  url: "https://dictionary.iucr.org/Scherrer_equation",
} as const satisfies CalculatorSource);

export const FOUR_POINT_PROBE_SOURCE = Object.freeze({
  id: "NBS:SP400-10",
  title: "Spreading Resistance Symposium Proceedings",
  publisher: "US National Bureau of Standards",
  url: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nbsspecialpublication400-10.pdf",
} as const satisfies CalculatorSource);

export const HALL_SOURCE = Object.freeze({
  id: "NIST:HallEffect",
  title: "The Hall Effect",
  publisher: "National Institute of Standards and Technology",
  url: "https://www.nist.gov/pml/nanoscale-device-characterization-division/popular-links/hall-effect/hall-effect",
} as const satisfies CalculatorSource);

export const VACUUM_SOURCE = Object.freeze({
  id: "CERN:ACC-2020-0009",
  title: "Vacuum Technology",
  publisher: "CERN Accelerator School",
  url: "https://cds.cern.ch/record/2646487/files/CERN-ACC-2020-0009.pdf",
} as const satisfies CalculatorSource);

export const LAB_CALCULATOR_SOURCES = Object.freeze([
  SCHERRER_SOURCE,
  FOUR_POINT_PROBE_SOURCE,
  HALL_SOURCE,
  VACUUM_SOURCE,
] as const);
