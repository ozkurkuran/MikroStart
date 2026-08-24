import {
  type CalculationIssue,
  type CalculationWarning,
  nonNegativeIssues,
  positiveIssues,
} from "./shared";
import { SCHERRER_SOURCE } from "./sources";
import {
  angleToRadians,
  lengthToMetres,
  type AngleUnit,
  type LengthUnit,
  type UnitValue,
} from "./units";

export interface ScherrerInput {
  wavelength: UnitValue<LengthUnit>;
  /** Observed peak FWHM in the 2θ scan. */
  fwhm: UnitValue<AngleUnit>;
  twoThetaDegrees: number;
  /** Defaults to 0.9 when omitted. */
  shapeFactor?: number;
  /** Instrument FWHM, removed by quadrature from the observed FWHM. */
  instrumentalFwhm?: UnitValue<AngleUnit>;
}

export interface ScherrerProvenance {
  algorithmId: "scherrer-crystallite-size";
  algorithmVersion: "1.0.0";
  formulaId: "scherrer:D=K*lambda/(sqrt(beta_obs^2-beta_inst^2)*cos(theta))";
  sourceIds: readonly ["IUCr:ScherrerEquation"];
  normalizedInputs: {
    wavelengthMetres: number;
    observedFwhmRadians: number;
    instrumentalFwhmRadians: number;
    correctedFwhmRadians: number;
    thetaRadians: number;
    shapeFactor: number;
  };
}

export type ScherrerOutcome =
  | {
      ok: true;
      result: {
        crystalliteSizeMetres: number;
        crystalliteSizeNanometres: number;
        correctedFwhmRadians: number;
      };
      warnings: CalculationWarning[];
      provenance: ScherrerProvenance;
    }
  | {
      ok: false;
      errors: CalculationIssue[];
      warnings: CalculationWarning[];
    };

export const SCHERRER_DEFAULT_SHAPE_FACTOR = 0.9;

/**
 * Calculates volume-weighted coherent-domain size with the Scherrer equation.
 * Lengths are converted to metres and line widths to radians before evaluation.
 */
export function calculateScherrer(input: ScherrerInput): ScherrerOutcome {
  const wavelengthMetres = lengthToMetres(input.wavelength);
  const observedFwhmRadians = angleToRadians(input.fwhm);
  const instrumentalFwhmRadians = input.instrumentalFwhm
    ? angleToRadians(input.instrumentalFwhm)
    : 0;
  const shapeFactor = input.shapeFactor ?? SCHERRER_DEFAULT_SHAPE_FACTOR;
  const thetaRadians = (input.twoThetaDegrees / 2) * (Math.PI / 180);

  const errors: CalculationIssue[] = [
    ...positiveIssues(wavelengthMetres, "wavelength"),
    ...positiveIssues(observedFwhmRadians, "fwhm"),
    ...nonNegativeIssues(instrumentalFwhmRadians, "instrumentalFwhm"),
    ...positiveIssues(shapeFactor, "shapeFactor"),
  ];
  const warnings: CalculationWarning[] = [];

  if (!Number.isFinite(input.twoThetaDegrees)) {
    errors.push({
      code: "NOT_FINITE",
      field: "twoTheta",
      message: "twoTheta must be a finite number.",
    });
  } else if (input.twoThetaDegrees <= 0 || input.twoThetaDegrees >= 180) {
    errors.push({
      code: "ANGLE_OUT_OF_RANGE",
      field: "twoTheta",
      message: "2θ must be greater than 0° and less than 180°.",
    });
  }

  if (
    Number.isFinite(instrumentalFwhmRadians) &&
    Number.isFinite(observedFwhmRadians) &&
    instrumentalFwhmRadians >= observedFwhmRadians
  ) {
    errors.push({
      code: "INSTRUMENT_BROADENING_TOO_LARGE",
      field: "instrumentalFwhm",
      message: "Instrument FWHM must be smaller than the observed FWHM.",
    });
  }

  if (shapeFactor < 0.8 || shapeFactor > 1.1) {
    warnings.push({
      code: "UNUSUAL_SHAPE_FACTOR",
      message:
        "The shape factor is outside the common 0.8–1.1 range; document the morphology model used.",
    });
  }
  if (observedFwhmRadians > 10 * (Math.PI / 180)) {
    warnings.push({
      code: "VERY_BROAD_PEAK",
      message:
        "The observed FWHM exceeds 10°; the isolated-peak Scherrer approximation may be unreliable.",
    });
  }
  if (!input.instrumentalFwhm) {
    warnings.push({
      code: "NO_INSTRUMENT_CORRECTION",
      message:
        "Instrument broadening is assumed to be zero, so the reported size may be underestimated.",
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  const correctedFwhmRadians = Math.sqrt(
    observedFwhmRadians ** 2 - instrumentalFwhmRadians ** 2,
  );
  const crystalliteSizeMetres =
    (shapeFactor * wavelengthMetres) /
    (correctedFwhmRadians * Math.cos(thetaRadians));

  return {
    ok: true,
    result: {
      crystalliteSizeMetres,
      crystalliteSizeNanometres: crystalliteSizeMetres * 1e9,
      correctedFwhmRadians,
    },
    warnings,
    provenance: {
      algorithmId: "scherrer-crystallite-size",
      algorithmVersion: "1.0.0",
      formulaId:
        "scherrer:D=K*lambda/(sqrt(beta_obs^2-beta_inst^2)*cos(theta))",
      sourceIds: [SCHERRER_SOURCE.id],
      normalizedInputs: {
        wavelengthMetres,
        observedFwhmRadians,
        instrumentalFwhmRadians,
        correctedFwhmRadians,
        thetaRadians,
        shapeFactor,
      },
    },
  };
}

