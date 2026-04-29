export function solve(input) {
  const lines = String(input).trimEnd().split('\n');
  const count = Number(lines[0]);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('invalid deque command count');
  }

  const commands = lines.slice(1, 1 + count);
  if (commands.length !== count) {
    throw new Error('deque input ended before all commands were read');
  }

  const deque = [];
  const output = [];

  for (const command of commands) {
    const [op, value] = command.split(' ');
    if (op === 'push_front') {
      deque.unshift(Number(value));
    } else if (op === 'push_back') {
      deque.push(Number(value));
    } else if (op === 'pop_front') {
      output.push(deque.length ? deque.shift() : -1);
    } else if (op === 'pop_back') {
      output.push(deque.length ? deque.pop() : -1);
    } else if (op === 'size') {
      output.push(deque.length);
    } else if (op === 'empty') {
      output.push(deque.length === 0 ? 1 : 0);
    } else if (op === 'front') {
      output.push(deque.length ? deque[0] : -1);
    } else if (op === 'back') {
      output.push(deque.length ? deque[deque.length - 1] : -1);
    } else {
      throw new Error(`invalid deque command: ${command}`);
    }
  }

  return output.length ? `${output.join('\n')}\n` : '';
}
