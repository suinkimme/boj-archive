import { randomBytes } from 'node:crypto';

export function makeRandomSeed() {
  return String(randomBytes(4).readUInt32BE(0));
}

export function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class Rng {
  constructor(seed) {
    this.seed = String(seed);
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  nextUint32() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  float() {
    return this.nextUint32() / 0x100000000;
  }

  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`invalid rng range: ${min}..${max}`);
    }
    return min + (this.nextUint32() % (max - min + 1));
  }

  bool(probability = 0.5) {
    return this.float() < probability;
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('cannot pick from an empty array');
    }
    return values[this.int(0, values.length - 1)];
  }
}

export function createRng(seed) {
  return new Rng(seed);
}
