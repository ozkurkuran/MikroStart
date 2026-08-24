import { BraggCalculator } from "./BraggCalculator";
import { BRAGG_SOURCE } from "./engine";

/**
 * Framework-light descriptor for registration in the dashboard's compile-time
 * module registry. It deliberately declares no network or browser capability.
 */
export const braggCalculatorModule = Object.freeze({
  id: "calculator.bragg-spacing",
  kind: "calculator" as const,
  version: "1.0.0",
  title: "Bragg / d-spacing",
  description:
    "Solve first-order Bragg diffraction for d-spacing or diffraction angle.",
  tags: ["xrd", "diffraction", "crystallography"] as const,
  capabilities: [] as const,
  references: [BRAGG_SOURCE] as const,
  Component: BraggCalculator,
});
