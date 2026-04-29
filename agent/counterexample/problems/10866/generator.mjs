const fixedCases = [
  ['front', 'back', 'pop_front', 'pop_back', 'size', 'empty'],
  ['push_front 1', 'front', 'back', 'pop_back', 'empty'],
  ['push_back 1', 'push_front 2', 'front', 'back', 'pop_front', 'pop_back', 'empty'],
  ['push_back 3', 'push_back 4', 'push_front 2', 'size', 'front', 'back', 'pop_front', 'pop_back', 'pop_back', 'pop_back'],
];

const queryOps = ['pop_front', 'pop_back', 'size', 'empty', 'front', 'back'];

function buildInput(commands) {
  return `${commands.length}\n${commands.join('\n')}\n`;
}

export function generateCase({ rng, runIndex }) {
  const fixed = fixedCases[runIndex];
  if (fixed) {
    return {
      input: buildInput(fixed),
      meta: {
        strategy: 'fixed-deque-edge',
        commandCount: fixed.length,
      },
    };
  }

  const commands = [];
  const commandCount = rng.int(1, 60);
  for (let i = 0; i < commandCount; i += 1) {
    if (rng.bool(0.45)) {
      const direction = rng.bool() ? 'front' : 'back';
      commands.push(`push_${direction} ${rng.int(1, 100)}`);
    } else {
      commands.push(rng.pick(queryOps));
    }
  }

  if (!commands.some((command) => !command.startsWith('push_'))) {
    commands.push('size');
  }

  return {
    input: buildInput(commands),
    meta: {
      strategy: 'random-deque-stream',
      commandCount: commands.length,
    },
  };
}
