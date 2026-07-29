// Inline amount calculator (v1.1 piece 4): evaluates + − × ÷ with
// standard precedence over decimal numbers. Returns a number rounded
// to cents, or null when the text isn't a complete valid expression.
// No eval, no Function — a strict hand-rolled tokenizer keeps the
// input inert (form input must never reach an interpreter).

const OPS = { "+": 1, "-": 1, "*": 2, "/": 2 };

export function evaluateAmount(text) {
  const cleaned = text
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll(" ", "");
  if (cleaned === "") return null;
  const tokens = cleaned.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join("") !== cleaned) return null;

  // shunting-yard to RPN, then fold — 20 lines beat a dependency
  const output = [];
  const stack = [];
  let expectNumber = true;
  for (const token of tokens) {
    if (token in OPS) {
      if (expectNumber) return null; // leading or doubled operator
      while (stack.length && OPS[stack.at(-1)] >= OPS[token]) output.push(stack.pop());
      stack.push(token);
      expectNumber = true;
    } else {
      if (!expectNumber) return null;
      output.push(Number(token));
      expectNumber = false;
    }
  }
  if (expectNumber) return null; // trailing operator
  output.push(...stack.reverse());

  const calc = [];
  for (const token of output) {
    if (typeof token === "number") {
      calc.push(token);
    } else {
      const b = calc.pop();
      const a = calc.pop();
      calc.push(
        token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : a / b,
      );
    }
  }
  const result = calc[0];
  if (!Number.isFinite(result)) return null; // e.g. division by zero
  return Math.round(result * 100) / 100;
}

// An operator anywhere but a leading minus means "this is a calculation"
export function hasOperator(text) {
  return /[+*/×÷]/.test(text) || /.-/.test(text.trim());
}
