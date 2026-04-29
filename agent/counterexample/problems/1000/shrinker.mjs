export function shrinkCandidates({ input }) {
  const [a, b] = String(input).trim().split(/\s+/).map(Number);
  const candidates = [];

  if (a !== 1) {
    candidates.push({ input: `1 ${b}\n`, reason: 'reduce first operand' });
  }
  if (b !== 1) {
    candidates.push({ input: `${a} 1\n`, reason: 'reduce second operand' });
  }
  if (a !== 1 || b !== 1) {
    candidates.push({ input: '1 1\n', reason: 'minimum operands' });
  }

  return candidates;
}
