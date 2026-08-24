export type LengthUnit = "angstrom" | "nm";

export type BraggSolveFor = "dSpacing" | "twoTheta";

export interface LengthValue {
  value: number;
  unit: LengthUnit;
}

export interface SolveDSpacingInput {
  solveFor: "dSpacing";
  wavelength: LengthValue;
  /** The measured diffraction angle, 2θ, in degrees. */
  twoThetaDegrees: number;
}

export interface SolveTwoThetaInput {
  solveFor: "twoTheta";
  wavelength: LengthValue;
  dSpacing: LengthValue;
}

export type BraggCalculationInput =
  | SolveDSpacingInput
  | SolveTwoThetaInput;

export type BraggField = "wavelength" | "twoTheta" | "dSpacing";

export interface BraggValidationIssue {
  code:
    | "NOT_FINITE"
    | "MUST_BE_POSITIVE"
    | "ANGLE_OUT_OF_RANGE"
    | "NO_PHYSICAL_SOLUTION";
  field: BraggField;
  message: string;
}

export interface BraggWarning {
  code:
    | "LOW_ANGLE_SENSITIVITY"
    | "BACKSCATTER_LIMIT"
    | "UNUSUAL_XRAY_WAVELENGTH";
  message: string;
}

export interface NormalizedBraggInputs {
  solveFor: BraggSolveFor;
  order: 1;
  wavelengthAngstrom: number;
  twoThetaDegrees?: number;
  dSpacingAngstrom?: number;
}

export interface BraggProvenance {
  algorithmId: "bragg-law-first-order";
  algorithmVersion: "1.0.0";
  formulaId:
    | "bragg-law:d=lambda/(2*sin(two-theta/2))"
    | "bragg-law:two-theta=2*asin(lambda/(2*d))";
  sourceIds: readonly ["IUCr:BraggLaw"];
  normalizedInputs: NormalizedBraggInputs;
}

export interface BraggSuccess {
  ok: true;
  result:
    | {
        quantity: "dSpacing";
        value: number;
        unit: LengthUnit;
      }
    | {
        quantity: "twoTheta";
        value: number;
        unit: "degree";
      };
  warnings: BraggWarning[];
  provenance: BraggProvenance;
}

export interface BraggFailure {
  ok: false;
  errors: BraggValidationIssue[];
  warnings: BraggWarning[];
}

export type BraggCalculationOutcome = BraggSuccess | BraggFailure;

export const CU_K_ALPHA_WAVELENGTH: Readonly<LengthValue> = Object.freeze({
  value: 1.5406,
  unit: "angstrom",
});

export const BRAGG_SOURCE = Object.freeze({
  id: "IUCr:BraggLaw" as const,
  title: "Bragg's law",
  publisher: "International Union of Crystallography",
  url: "https://dictionary.iucr.org/Bragg%27s_law",
});

const ANGSTROM_PER_NANOMETRE = 10;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function convertLength(
  value: number,
  from: LengthUnit,
  to: LengthUnit,
): number {
  if (from === to) return value;
  return from === "nm" ? value * ANGSTROM_PER_NANOMETRE : value / ANGSTROM_PER_NANOMETRE;
}

function validatePositiveFinite(
  value: number,
  field: BraggField,
): BraggValidationIssue[] {
  if (!Number.isFinite(value)) {
    return [
      {
        code: "NOT_FINITE",
        field,
        message: `${field} must be a finite number.`,
      },
    ];
  }

  if (value <= 0) {
    return [
      {
        code: "MUST_BE_POSITIVE",
        field,
        message: `${field} must be greater than zero.`,
      },
    ];
  }

  return [];
}

function angleWarnings(twoThetaDegrees: number): BraggWarning[] {
  const warnings: BraggWarning[] = [];

  if (twoThetaDegrees < 1) {
    warnings.push({
      code: "LOW_ANGLE_SENSITIVITY",
      message:
        "2θ is below 1°; small angle errors can produce a large d-spacing uncertainty.",
    });
  }

  if (twoThetaDegrees > 170) {
    warnings.push({
      code: "BACKSCATTER_LIMIT",
      message:
        "2θ is near the 180° backscatter limit; verify instrument geometry and precision.",
    });
  }

  return warnings;
}

function wavelengthWarnings(wavelengthAngstrom: number): BraggWarning[] {
  if (wavelengthAngstrom < 0.1 || wavelengthAngstrom > 10) {
    return [
      {
        code: "UNUSUAL_XRAY_WAVELENGTH",
        message:
          "The wavelength is outside the typical 0.1–10 Å X-ray range; confirm its value and unit.",
      },
    ];
  }
  return [];
}

/**
 * Applies first-order Bragg diffraction (n = 1): λ = 2d sin(θ).
 *
 * The public input keeps length units explicit. Internally all lengths are
 * normalized to ångströms and all inverse trigonometry uses radians.
 */
export function calculateBragg(
  input: BraggCalculationInput,
): BraggCalculationOutcome {
  const wavelengthAngstrom = convertLength(
    input.wavelength.value,
    input.wavelength.unit,
    "angstrom",
  );
  const errors = validatePositiveFinite(wavelengthAngstrom, "wavelength");
  const warnings = wavelengthWarnings(wavelengthAngstrom);

  if (input.solveFor === "dSpacing") {
    errors.push(
      ...validatePositiveFinite(input.twoThetaDegrees, "twoTheta"),
    );

    if (
      Number.isFinite(input.twoThetaDegrees) &&
      input.twoThetaDegrees > 180
    ) {
      errors.push({
        code: "ANGLE_OUT_OF_RANGE",
        field: "twoTheta",
        message: "2θ must be greater than 0° and no greater than 180°.",
      });
    }

    warnings.push(...angleWarnings(input.twoThetaDegrees));

    if (errors.length > 0) return { ok: false, errors, warnings };

    const thetaRadians = (input.twoThetaDegrees / 2) * DEG_TO_RAD;
    const dSpacingAngstrom =
      wavelengthAngstrom / (2 * Math.sin(thetaRadians));

    return {
      ok: true,
      result: {
        quantity: "dSpacing",
        value: convertLength(
          dSpacingAngstrom,
          "angstrom",
          input.wavelength.unit,
        ),
        unit: input.wavelength.unit,
      },
      warnings,
      provenance: {
        algorithmId: "bragg-law-first-order",
        algorithmVersion: "1.0.0",
        formulaId: "bragg-law:d=lambda/(2*sin(two-theta/2))",
        sourceIds: [BRAGG_SOURCE.id],
        normalizedInputs: {
          solveFor: input.solveFor,
          order: 1,
          wavelengthAngstrom,
          twoThetaDegrees: input.twoThetaDegrees,
        },
      },
    };
  }

  const dSpacingAngstrom = convertLength(
    input.dSpacing.value,
    input.dSpacing.unit,
    "angstrom",
  );
  errors.push(...validatePositiveFinite(dSpacingAngstrom, "dSpacing"));

  if (errors.length > 0) return { ok: false, errors, warnings };

  const sineTheta = wavelengthAngstrom / (2 * dSpacingAngstrom);
  if (sineTheta > 1) {
    errors.push({
      code: "NO_PHYSICAL_SOLUTION",
      field: "dSpacing",
      message:
        "No first-order reflection exists because wavelength / (2d) is greater than 1.",
    });
    return { ok: false, errors, warnings };
  }

  const twoThetaDegrees = 2 * Math.asin(sineTheta) * RAD_TO_DEG;
  warnings.push(...angleWarnings(twoThetaDegrees));

  return {
    ok: true,
    result: {
      quantity: "twoTheta",
      value: twoThetaDegrees,
      unit: "degree",
    },
    warnings,
    provenance: {
      algorithmId: "bragg-law-first-order",
      algorithmVersion: "1.0.0",
      formulaId: "bragg-law:two-theta=2*asin(lambda/(2*d))",
      sourceIds: [BRAGG_SOURCE.id],
      normalizedInputs: {
        solveFor: input.solveFor,
        order: 1,
        wavelengthAngstrom,
        dSpacingAngstrom,
      },
    },
  };
}
