import {
  type CalculationIssue,
  type CalculationWarning,
  finiteIssue,
  positiveIssues,
} from "./shared";
import { HALL_SOURCE } from "./sources";
import {
  currentToAmperes,
  lengthToMetres,
  magneticFieldToTesla,
  voltageToVolts,
  type CurrentUnit,
  type LengthUnit,
  type MagneticFieldUnit,
  type UnitValue,
  type VoltageUnit,
} from "./units";

export interface HallInput {
  current: UnitValue<CurrentUnit>;
  magneticField: UnitValue<MagneticFieldUnit>;
  thickness: UnitValue<LengthUnit>;
  hallVoltage: UnitValue<VoltageUnit>;
  sheetResistanceOhmsPerSquare: number;
}

export interface HallProvenance {
  algorithmId: "single-carrier-hall";
  algorithmVersion: "1.0.0";
  formulaId: "hall:RH=Vh*t/(I*B);n=1/(q*abs(RH));mu=abs(RH)/(Rs*t)";
  sourceIds: readonly ["NIST:HallEffect"];
  normalizedInputs: {
    currentAmperes: number;
    magneticFieldTesla: number;
    thicknessMetres: number;
    hallVoltageVolts: number;
    sheetResistanceOhmsPerSquare: number;
    elementaryChargeCoulombs: number;
  };
}

export type HallOutcome =
  | {
      ok: true;
      result: {
        hallCoefficientCubicMetresPerCoulomb: number;
        hallCoefficientCubicCentimetresPerCoulomb: number;
        carrierDensityPerCubicMetre: number;
        carrierDensityPerCubicCentimetre: number;
        mobilitySquareMetresPerVoltSecond: number;
        mobilitySquareCentimetresPerVoltSecond: number;
        bulkResistivityOhmMetres: number;
        conventionalDominantCarrier: "electron" | "hole";
      };
      warnings: CalculationWarning[];
      provenance: HallProvenance;
    }
  | {
      ok: false;
      errors: CalculationIssue[];
      warnings: CalculationWarning[];
    };

export const ELEMENTARY_CHARGE_COULOMBS = 1.602_176_634e-19;

function validateSignedNonZero(
  value: number,
  field: string,
): CalculationIssue[] {
  const issue = finiteIssue(value, field);
  if (issue) return [issue];
  return value === 0
    ? [
        {
          code: "MUST_BE_NON_ZERO",
          field,
          message: `${field} must be non-zero.`,
        },
      ]
    : [];
}

/**
 * Evaluates the uniform, single-majority-carrier Hall model in SI units.
 * The carrier sign follows the supplied current/field/voltage orientation.
 */
export function calculateHall(input: HallInput): HallOutcome {
  const currentAmperes = currentToAmperes(input.current);
  const magneticFieldTesla = magneticFieldToTesla(input.magneticField);
  const thicknessMetres = lengthToMetres(input.thickness);
  const hallVoltageVolts = voltageToVolts(input.hallVoltage);
  const errors: CalculationIssue[] = [
    ...validateSignedNonZero(currentAmperes, "current"),
    ...validateSignedNonZero(magneticFieldTesla, "magneticField"),
    ...positiveIssues(thicknessMetres, "thickness"),
    ...validateSignedNonZero(hallVoltageVolts, "hallVoltage"),
    ...positiveIssues(
      input.sheetResistanceOhmsPerSquare,
      "sheetResistance",
    ),
  ];
  const warnings: CalculationWarning[] = [
    {
      code: "SINGLE_CARRIER_MODEL",
      message:
        "Carrier density and mobility assume one dominant carrier type in a uniform conducting layer.",
    },
    {
      code: "REVERSAL_AVERAGING_RECOMMENDED",
      message:
        "Use current and magnetic-field reversal measurements to remove contact and thermoelectric offsets.",
    },
  ];

  if (Math.abs(hallVoltageVolts) < 1e-6) {
    warnings.push({
      code: "LOW_HALL_SIGNAL",
      message: "The Hall voltage is below 1 µV; check offset and noise rejection.",
    });
  }
  if (Math.abs(magneticFieldTesla) < 1e-3) {
    warnings.push({
      code: "LOW_MAGNETIC_FIELD",
      message: "The magnetic field is below 1 mT; the Hall signal may be weak.",
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const bulkResistivityOhmMetres =
    input.sheetResistanceOhmsPerSquare * thicknessMetres;
  const hallCoefficientCubicMetresPerCoulomb =
    (hallVoltageVolts * thicknessMetres) /
    (currentAmperes * magneticFieldTesla);
  const carrierDensityPerCubicMetre =
    1 /
    (ELEMENTARY_CHARGE_COULOMBS *
      Math.abs(hallCoefficientCubicMetresPerCoulomb));
  const mobilitySquareMetresPerVoltSecond =
    Math.abs(hallCoefficientCubicMetresPerCoulomb) /
    bulkResistivityOhmMetres;

  return {
    ok: true,
    result: {
      hallCoefficientCubicMetresPerCoulomb,
      hallCoefficientCubicCentimetresPerCoulomb:
        hallCoefficientCubicMetresPerCoulomb * 1e6,
      carrierDensityPerCubicMetre,
      carrierDensityPerCubicCentimetre: carrierDensityPerCubicMetre / 1e6,
      mobilitySquareMetresPerVoltSecond,
      mobilitySquareCentimetresPerVoltSecond:
        mobilitySquareMetresPerVoltSecond * 1e4,
      bulkResistivityOhmMetres,
      conventionalDominantCarrier:
        hallCoefficientCubicMetresPerCoulomb < 0 ? "electron" : "hole",
    },
    warnings,
    provenance: {
      algorithmId: "single-carrier-hall",
      algorithmVersion: "1.0.0",
      formulaId:
        "hall:RH=Vh*t/(I*B);n=1/(q*abs(RH));mu=abs(RH)/(Rs*t)",
      sourceIds: [HALL_SOURCE.id],
      normalizedInputs: {
        currentAmperes,
        magneticFieldTesla,
        thicknessMetres,
        hallVoltageVolts,
        sheetResistanceOhmsPerSquare: input.sheetResistanceOhmsPerSquare,
        elementaryChargeCoulombs: ELEMENTARY_CHARGE_COULOMBS,
      },
    },
  };
}

