import { LabCalculatorPack } from "./LabCalculatorPack";
import {
  FOUR_POINT_PROBE_SOURCE,
  HALL_SOURCE,
  LAB_CALCULATOR_SOURCES,
  SCHERRER_SOURCE,
  VACUUM_SOURCE,
} from "./sources";

export const labCalculatorPackModule = Object.freeze({
  id: "calculator.lab-pack",
  kind: "calculator" as const,
  version: "1.0.0",
  title: "Lab calculator pack",
  description:
    "Scherrer, four-point-probe, Hall and vacuum calculations with explicit units and provenance.",
  tags: [
    "xrd",
    "thin-film",
    "hall-effect",
    "vacuum",
    "materials-science",
  ] as const,
  capabilities: [] as const,
  references: LAB_CALCULATOR_SOURCES,
  calculators: [
    {
      id: "scherrer",
      title: "Scherrer crystallite size",
      algorithmVersion: "1.0.0",
      references: [SCHERRER_SOURCE],
    },
    {
      id: "four-point-probe",
      title: "Four-point-probe sheet resistance",
      algorithmVersion: "1.0.0",
      references: [FOUR_POINT_PROBE_SOURCE],
    },
    {
      id: "single-carrier-hall",
      title: "Single-carrier Hall measurement",
      algorithmVersion: "1.0.0",
      references: [HALL_SOURCE],
    },
    {
      id: "vacuum-gas-kinetics",
      title: "Vacuum mean free path and monolayer time",
      algorithmVersion: "1.0.0",
      references: [VACUUM_SOURCE],
    },
  ] as const,
  Component: LabCalculatorPack,
});

