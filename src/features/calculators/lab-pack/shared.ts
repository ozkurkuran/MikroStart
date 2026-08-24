export interface CalculatorSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export interface CalculationIssue {
  code: string;
  field: string;
  message: string;
}

export interface CalculationWarning {
  code: string;
  message: string;
}

export function finiteIssue(
  value: number,
  field: string,
): CalculationIssue | undefined {
  return Number.isFinite(value)
    ? undefined
    : {
        code: "NOT_FINITE",
        field,
        message: `${field} must be a finite number.`,
      };
}

export function positiveIssues(
  value: number,
  field: string,
): CalculationIssue[] {
  const issue = finiteIssue(value, field);
  if (issue) return [issue];
  return value > 0
    ? []
    : [
        {
          code: "MUST_BE_POSITIVE",
          field,
          message: `${field} must be greater than zero.`,
        },
      ];
}

export function nonNegativeIssues(
  value: number,
  field: string,
): CalculationIssue[] {
  const issue = finiteIssue(value, field);
  if (issue) return [issue];
  return value >= 0
    ? []
    : [
        {
          code: "MUST_BE_NON_NEGATIVE",
          field,
          message: `${field} must be zero or greater.`,
        },
      ];
}

