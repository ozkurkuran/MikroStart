export type AngleMode = "deg" | "rad";

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; value: string }
  | { kind: "operator"; value: string }
  | { kind: "left" }
  | { kind: "right" };

const FUNCTIONS: Readonly<Record<string, (value: number, mode: AngleMode) => number>> = {
  sin: (value, mode) => Math.sin(mode === "deg" ? (value * Math.PI) / 180 : value),
  cos: (value, mode) => Math.cos(mode === "deg" ? (value * Math.PI) / 180 : value),
  tan: (value, mode) => Math.tan(mode === "deg" ? (value * Math.PI) / 180 : value),
  asin: (value, mode) => {
    const result = Math.asin(value);
    return mode === "deg" ? (result * 180) / Math.PI : result;
  },
  acos: (value, mode) => {
    const result = Math.acos(value);
    return mode === "deg" ? (result * 180) / Math.PI : result;
  },
  atan: (value, mode) => {
    const result = Math.atan(value);
    return mode === "deg" ? (result * 180) / Math.PI : result;
  },
  sqrt: (value) => Math.sqrt(value),
  ln: (value) => Math.log(value),
  log: (value) => Math.log10(value),
  exp: (value) => Math.exp(value),
  abs: (value) => Math.abs(value),
};

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      const value = Number(number[0].replace(",", "."));
      if (!Number.isFinite(value)) throw new Error("Invalid number");
      tokens.push({ kind: "number", value });
      index += number[0].length;
      continue;
    }
    const name = rest.match(/^[a-z]+/i);
    if (name) {
      tokens.push({ kind: "name", value: name[0].toLowerCase() });
      index += name[0].length;
      continue;
    }
    const character = rest[0];
    if ("+-*/^%!".includes(character)) tokens.push({ kind: "operator", value: character });
    else if (character === "(") tokens.push({ kind: "left" });
    else if (character === ")") tokens.push({ kind: "right" });
    else throw new Error(`Unexpected character: ${character}`);
    index += 1;
  }
  return tokens;
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 170) {
    throw new Error("Factorial requires an integer from 0 to 170");
  }
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

export function evaluateExpression(
  expression: string,
  options: { angleMode?: AngleMode; memory?: number; answer?: number } = {},
): number {
  const tokens = tokenize(expression);
  const angleMode = options.angleMode ?? "deg";
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary(): number {
    const token = take();
    if (!token) throw new Error("Incomplete expression");
    if (token.kind === "number") return token.value;
    if (token.kind === "left") {
      const value = addSubtract();
      if (take()?.kind !== "right") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (token.kind === "name") {
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      if (token.value === "mem") return options.memory ?? 0;
      if (token.value === "ans") return options.answer ?? 0;
      const fn = FUNCTIONS[token.value];
      if (!fn) throw new Error(`Unknown function: ${token.value}`);
      if (take()?.kind !== "left") throw new Error("Function requires parentheses");
      const value = addSubtract();
      if (take()?.kind !== "right") throw new Error("Missing closing parenthesis");
      return fn(value, angleMode);
    }
    throw new Error("Expected a number");
  }

  function postfix(): number {
    let value = primary();
    while (peek()?.kind === "operator" && (peek() as { value: string }).value.match(/[!%]/)) {
      const operator = (take() as { value: string }).value;
      value = operator === "!" ? factorial(value) : value / 100;
    }
    return value;
  }

  function unary(): number {
    const token = peek();
    if (token?.kind === "operator" && (token.value === "+" || token.value === "-")) {
      take();
      const value = unary();
      return token.value === "-" ? -value : value;
    }
    return postfix();
  }

  function power(): number {
    const value = unary();
    if (peek()?.kind === "operator" && (peek() as { value: string }).value === "^") {
      take();
      return value ** power();
    }
    return value;
  }

  function multiplyDivide(): number {
    let value = power();
    while (peek()?.kind === "operator" && ["*", "/"].includes((peek() as { value: string }).value)) {
      const operator = (take() as { value: string }).value;
      const right = power();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function addSubtract(): number {
    let value = multiplyDivide();
    while (peek()?.kind === "operator" && ["+", "-"].includes((peek() as { value: string }).value)) {
      const operator = (take() as { value: string }).value;
      const right = multiplyDivide();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  if (tokens.length === 0) throw new Error("Expression is empty");
  const result = addSubtract();
  if (position !== tokens.length) throw new Error("Unexpected token");
  if (!Number.isFinite(result)) throw new Error("Result is not finite");
  return result;
}

export function formatCalculation(value: number): string {
  const absolute = Math.abs(value);
  if ((absolute !== 0 && absolute < 1e-7) || absolute >= 1e10) {
    return value.toExponential(10).replace(/\.0+e/, "e").replace(/(\.\d*?)0+e/, "$1e");
  }
  return Number(value.toPrecision(12)).toString();
}
