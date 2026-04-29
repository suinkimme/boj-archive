const fixedCases = [
  [1, 1],
  [1, 9],
  [9, 1],
  [9, 9],
];

export function generateCase({ rng, runIndex }) {
  const pair = fixedCases[runIndex] ?? [rng.int(1, 9), rng.int(1, 9)];
  const [a, b] = pair;
  return {
    input: `${a} ${b}\n`,
    meta: {
      strategy: runIndex < fixedCases.length ? 'fixed-edge' : 'random-small-arithmetic',
      a,
      b,
    },
  };
}
