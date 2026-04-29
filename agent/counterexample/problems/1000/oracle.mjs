export function solve(input) {
  const [a, b] = String(input).trim().split(/\s+/).map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('invalid A+B input');
  }
  return `${a + b}\n`;
}
