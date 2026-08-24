import {
  type CalculationIssue,
  type CalculationWarning,
  finiteIssue,
  positiveIssues,
} from "./shared";
import { FOUR_POINT_PROBE_SOURCE } from "./sources";
import {
  currentToAmperes,
  lengthToMetres,
  voltageToVolts,
  type CurrentUnit,
  type LengthUnit,
  type UnitValue,
  type VoltageUnit,
} from "./units";

export interface SheetResistanceInput {
  voltage: UnitValue<VoltageUnit>;
  current: UnitValue<CurrentUnit>;
  /** Conducting-film thickness; omit to calculate sheet resistance only. */
  thickness?: UnitValue<LengthUnit>;
}

export interface SheetResistanceProvenance {
  algorithmId: "four-point-probe-infinite-sheet";
  algorithmVersion: "1.0.0";
  formulaId: "four-point-probe:Rs=(pi/ln(2))*abs(V/I);rho=Rs*t";
  sourceIds: readonly ["NBS:SP400-10"];
  normalizedInputs: {
    voltageVolts: number;
    currentAmperes: number;
    thicknessMetres?: number;
    geometryFactor: number;
  };
}

export type SheetResistanceOutcome =
  | {
      ok: true;
      result: {
        sheetResistanceOhmsPerSquare: number;
        resistivityOhmMetres?: number;
        resistivityOhmCentimetres?: number;
      };
      warnings: CalculationWarning[];
      provenance: SheetResistanceProvenance;
    }
  | {
      ok: false;
      errors: CalculationIssue[];
      warnings: CalculationWarning[];
    };

export const FOUR_POINT_PROBE_GEOMETRY_FACTOR = Math.PI / Math.log(2);

/**
 * Applies the equally spaced, collinear four-point-probe infinite-sheet model.
 * Voltage and current are normalized to SI; optional resistivity is Ω·m.
 */
export function calculateSheetResistance(
  input: SheetResistanceInput,
): SheetResistanceOutcome {
  const voltageVolts = voltageToVolts(input.voltage);
  const currentAmperes = currentToAmperes(input.current);
  const thicknessMetres = input.thickness
    ? lengthToMetres(input.thickness)
    : undefined;
  const errors: CalculationIssue[] = [];
  const warnings: CalculationWarning[] = [
    {
      code: "INFINITE_SHEET_APPROXIMATION",
      message:
        "π/ln(2) assumes an equally spaced collinear probe on a laterally infinite, uniform thin sheet; apply a geometry correction for finite samples or nearby edges.",
    },
  ];

  const voltageIssue = finiteIssue(voltageVolts, "voltage");
  const currentIssue = finiteIssue(currentAmperes, "current");
  if (voltageIssue) errors.push(voltageIssue);
  if (currentIssue) errors.push(currentIssue);
  if (!voltageIssue && voltageVolts === 0) {
    errors.push({
      code: "MUST_BE_NON_ZERO",
      field: "voltage",
      message: "voltage must be non-zero.",
    });
  }
  if (!currentIssue && currentAmperes === 0) {
    errors.push({
      code: "MUST_BE_NON_ZERO",
      field: "current",
      message: "current must be non-zero.",
    });
  }
  if (thicknessMetres !== undefined) {
    errors.push(...positiveIssues(thicknessMetres, "thickness"));
  }
  if (voltageVolts < 0 || currentAmperes < 0) {
    warnings.push({
      code: "POLARITY_IGNORED",
      message:
        "Sheet resistance uses |V/I|; reverse-polarity measurements should be averaged to suppress offsets.",
    });
  }
  if (Math.abs(voltageVolts) < 1e-6) {
    warnings.push({
      code: "LOW_VOLTAGE_SIGNAL",
      message: "The voltage is below 1 µV; verify the instrument noise floor.",
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const sheetResistanceOhmsPerSquare =
    FOUR_POINT_PROBE_GEOMETRY_FACTOR *
    Math.abs(voltageVolts / currentAmperes);
  const resistivityOhmMetres =
    thicknessMetres === undefined
      ? undefined
      : sheetResistanceOhmsPerSquare * thicknessMetres;

  return {
    ok: true,
    result: {
      sheetResistanceOhmsPerSquare,
      ...(resistivityOhmMetres === undefined
        ? {}
        : {
            resistivityOhmMetres,
            resistivityOhmCentimetres: resistivityOhmMetres * 100,
          }),
    },
    warnings,
    provenance: {
      algorithmId: "four-point-probe-infinite-sheet",
      algorithmVersion: "1.0.0",
      formulaId: "four-point-probe:Rs=(pi/ln(2))*abs(V/I);rho=Rs*t",
      sourceIds: [FOUR_POINT_PROBE_SOURCE.id],
      normalizedInputs: {
        voltageVolts,
        currentAmperes,
        ...(thicknessMetres === undefined ? {} : { thicknessMetres }),
        geometryFactor: FOUR_POINT_PROBE_GEOMETRY_FACTOR,
      },
    },
  };
}

