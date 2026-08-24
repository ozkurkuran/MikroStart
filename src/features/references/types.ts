export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "reactive-nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide";

export interface DatasetSource {
  id: string;
  title: string;
  publisher: string;
  version: string;
  publishedAt?: string;
  url: string;
  licenseNote: string;
}

export interface PhysicalConstant {
  id: string;
  name: string;
  symbol: string;
  value: number;
  displayValue: string;
  unit: string;
  relativeStandardUncertainty: string;
  exact: boolean;
  aliases: readonly string[];
  sourceId: string;
}

export interface ChemicalElement {
  atomicNumber: number;
  symbol: string;
  name: string;
  /** Abridged standard atomic weight and uncertainty; null means none is assigned. */
  standardAtomicWeight: string | null;
  category: ElementCategory;
  sourceId: string;
}

export type ESeriesName = "E6" | "E12" | "E24";

export interface ESeries {
  name: ESeriesName;
  nominalTolerancePercent: number;
  values: readonly number[];
  sourceId: string;
}

export type ReferenceSearchResult =
  | { kind: "constant"; score: number; item: PhysicalConstant }
  | { kind: "element"; score: number; item: ChemicalElement }
  | { kind: "e-series"; score: number; item: ESeries };
