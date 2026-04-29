function parseCommands(input) {
  const lines = String(input).trimEnd().split('\n');
  const count = Number(lines[0]);
  return lines.slice(1, 1 + count);
}

function buildInput(commands) {
  return `${commands.length}\n${commands.join('\n')}\n`;
}

export function shrinkCandidates({ input }) {
  const commands = parseCommands(input);
  const candidates = [];

  if (commands.length > 1) {
    for (let i = 0; i < commands.length; i += 1) {
      candidates.push({
        input: buildInput(commands.filter((_, index) => index !== i)),
        reason: `remove command ${i}`,
      });
    }
  }

  for (let i = 0; i < commands.length; i += 1) {
    const match = commands[i].match(/^(push_front|push_back) (\d+)$/);
    if (!match || match[2] === '1') {
      continue;
    }
    const nextCommands = [...commands];
    nextCommands[i] = `${match[1]} 1`;
    candidates.push({
      input: buildInput(nextCommands),
      reason: `reduce pushed value at command ${i}`,
    });
  }

  return candidates;
}
