function isVps(text) {
  let balance = 0;
  for (const char of text) {
    if (char === '(') {
      balance += 1;
    } else if (char === ')') {
      balance -= 1;
      if (balance < 0) {
        return false;
      }
    } else {
      throw new Error(`invalid parenthesis character: ${char}`);
    }
  }
  return balance === 0;
}

export function solve(input) {
  const lines = String(input).trimEnd().split('\n');
  const count = Number(lines[0]);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('invalid VPS case count');
  }

  const cases = lines.slice(1, 1 + count);
  if (cases.length !== count) {
    throw new Error('VPS input ended before all cases were read');
  }

  return `${cases.map((text) => (isVps(text) ? 'YES' : 'NO')).join('\n')}\n`;
}
