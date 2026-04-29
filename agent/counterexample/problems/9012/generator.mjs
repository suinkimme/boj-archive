const fixedCases = [
  ['()'],
  ['('],
  [')('],
  ['(())', '(()'],
  ['()()()', '((()))', '())(()'],
];

function makeValidString(rng) {
  const pairs = rng.int(1, 8);
  let openLeft = pairs;
  let balance = 0;
  let result = '';

  while (openLeft > 0 || balance > 0) {
    if (openLeft === 0 || (balance > 0 && rng.bool(0.45))) {
      result += ')';
      balance -= 1;
    } else {
      result += '(';
      openLeft -= 1;
      balance += 1;
    }
  }

  return result;
}

function makeRandomString(rng) {
  const length = rng.int(1, 20);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += rng.bool() ? '(' : ')';
  }
  return result;
}

export function generateCase({ rng, runIndex }) {
  const cases = fixedCases[runIndex] ?? Array.from({ length: rng.int(1, 8) }, (_, index) => {
    if (index === 0 && rng.bool(0.35)) {
      return `)${makeRandomString(rng)}`;
    }
    return rng.bool(0.45) ? makeValidString(rng) : makeRandomString(rng);
  });

  return {
    input: `${cases.length}\n${cases.join('\n')}\n`,
    meta: {
      strategy: runIndex < fixedCases.length ? 'fixed-vps-edge' : 'random-vps-batch',
      caseCount: cases.length,
    },
  };
}
