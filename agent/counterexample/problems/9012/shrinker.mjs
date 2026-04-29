function parseCases(input) {
  const lines = String(input).trimEnd().split('\n');
  const count = Number(lines[0]);
  return lines.slice(1, 1 + count);
}

function buildInput(cases) {
  return `${cases.length}\n${cases.join('\n')}\n`;
}

export function shrinkCandidates({ input }) {
  const cases = parseCases(input);
  const candidates = [];

  if (cases.length > 1) {
    for (let i = 0; i < cases.length; i += 1) {
      candidates.push({
        input: buildInput(cases.filter((_, index) => index !== i)),
        reason: `remove case ${i}`,
      });
    }
  }

  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    const text = cases[caseIndex];
    if (text.length <= 1) {
      continue;
    }
    for (let charIndex = 0; charIndex < text.length; charIndex += 1) {
      const next = `${text.slice(0, charIndex)}${text.slice(charIndex + 1)}`;
      if (next.length === 0) {
        continue;
      }
      const nextCases = [...cases];
      nextCases[caseIndex] = next;
      candidates.push({
        input: buildInput(nextCases),
        reason: `remove char ${charIndex} from case ${caseIndex}`,
      });
    }
  }

  return candidates;
}
