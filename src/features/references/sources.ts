import type { DatasetSource } from "./types";

export const REFERENCE_SOURCES = {
  codata2022: {
    id: "nist-codata-2022-v9",
    title: "2022 CODATA Recommended Values of the Fundamental Physical Constants",
    publisher: "National Institute of Standards and Technology (NIST)",
    version: "Web Version 9.0",
    publishedAt: "2024-05-09",
    url: "https://physics.nist.gov/constants",
    licenseNote:
      "NIST data are treated as United States government works. Attribution and dataset version are retained; users should verify critical values against the cited source.",
  },
  atomicWeights2024: {
    id: "ciaaw-abridged-atomic-weights-2024",
    title: "Abridged Standard Atomic Weights 2024",
    publisher: "IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW)",
    version: "2024 abridged table",
    publishedAt: "2024",
    url: "https://ciaaw.org/abridged-atomic-weights.htm",
    licenseNote:
      "Facts are transcribed with attribution from the IUPAC/CIAAW table. IUPAC page design and logos are not reproduced. Confirm redistribution terms before publishing a derived bulk dataset.",
  },
  periodicTable2022: {
    id: "iupac-periodic-table-2022-05-04",
    title: "IUPAC Periodic Table of the Elements",
    publisher: "International Union of Pure and Applied Chemistry (IUPAC)",
    version: "4 May 2022",
    publishedAt: "2022-05-04",
    url: "https://iupac.org/what-we-do/periodic-table-of-elements/",
    licenseNote:
      "Element names, symbols, and atomic numbers are scientific facts. The original IUPAC table artwork is copyrighted and is not bundled here.",
  },
  eSeries2015: {
    id: "iec-60063-2015",
    title: "IEC 60063:2015 — Preferred number series for resistors and capacitors",
    publisher: "International Electrotechnical Commission (IEC)",
    version: "Edition 3.0",
    publishedAt: "2015-03-27",
    url: "https://webstore.iec.ch/en/publication/22011",
    licenseNote:
      "Only the commonly used numerical E6/E12/E24 series is represented. The IEC standard text is not redistributed.",
  },
} as const satisfies Record<string, DatasetSource>;

export const REFERENCE_DATASET_VERSION = "2026.08.1";
