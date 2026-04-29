import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { runCounterexample } from '../../agent/counterexample/harness.mjs';
import { normalizeOutput, outputsEqual } from '../../agent/counterexample/normalize-output.mjs';
import { createRng } from '../../agent/counterexample/rng.mjs';
import { solve as solve1000 } from '../../agent/counterexample/problems/1000/oracle.mjs';
import { generateCase as generate1000 } from '../../agent/counterexample/problems/1000/generator.mjs';
import { solve as solve9012 } from '../../agent/counterexample/problems/9012/oracle.mjs';
import { generateCase as generate9012 } from '../../agent/counterexample/problems/9012/generator.mjs';
import { solve as solve10866 } from '../../agent/counterexample/problems/10866/oracle.mjs';
import { generateCase as generate10866 } from '../../agent/counterexample/problems/10866/generator.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const scriptPath = path.join(repoRoot, 'scripts/counterexample.mjs');
const replayScriptPath = path.join(repoRoot, 'scripts/counterexample-replay.mjs');
const selfTestScriptPath = path.join(repoRoot, 'scripts/counterexample-self-test.mjs');
const supportScriptPath = path.join(repoRoot, 'scripts/counterexample-support.mjs');
const tempDirs = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'boj-ce-test-'));
  tempDirs.push(dir);
  return dir;
}

async function writeTempFile(name, contents) {
  const dir = await makeTempDir();
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, contents);
  return filePath;
}

async function runNodeScript(nodeScriptPath, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [nodeScriptPath, ...args], {
      cwd: repoRoot,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

async function runCli(args) {
  return runNodeScript(scriptPath, args);
}

async function runReplayCli(args) {
  return runNodeScript(replayScriptPath, args);
}

async function runSelfTestCli(args) {
  return runNodeScript(selfTestScriptPath, args);
}

async function runSupportCli(args) {
  return runNodeScript(supportScriptPath, args);
}

function correctAPlusBSource() {
  return `
const fs = require('fs');
const [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
console.log(a + b);
`;
}

function correctDequeSource() {
  return `
const fs = require('fs');
const lines = fs.readFileSync(0, 'utf8').trimEnd().split('\\n');
const n = Number(lines[0]);
const deque = [];
const output = [];
for (let i = 1; i <= n; i += 1) {
  const [op, value] = lines[i].split(' ');
  if (op === 'push_front') deque.unshift(Number(value));
  else if (op === 'push_back') deque.push(Number(value));
  else if (op === 'pop_front') output.push(deque.length ? deque.shift() : -1);
  else if (op === 'pop_back') output.push(deque.length ? deque.pop() : -1);
  else if (op === 'size') output.push(deque.length);
  else if (op === 'empty') output.push(deque.length === 0 ? 1 : 0);
  else if (op === 'front') output.push(deque.length ? deque[0] : -1);
  else if (op === 'back') output.push(deque.length ? deque[deque.length - 1] : -1);
}
process.stdout.write(output.length ? output.join('\\n') + '\\n' : '');
`;
}

function expectedVps(text) {
  let balance = 0;
  for (const char of text) {
    if (char === '(') {
      balance += 1;
    } else {
      balance -= 1;
      if (balance < 0) {
        return 'NO';
      }
    }
  }
  return balance === 0 ? 'YES' : 'NO';
}

function parenthesisStrings(length) {
  if (length === 0) {
    return [''];
  }
  return parenthesisStrings(length - 1).flatMap((prefix) => [`${prefix}(`, `${prefix})`]);
}

afterEach(async () => {
  while (tempDirs.length) {
    await fs.rm(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('counterexample utilities', () => {
  it('uses deterministic RNG sequences for the same seed', () => {
    const a = createRng('seed').int(1, 1000);
    const b = createRng('seed').int(1, 1000);
    expect(a).toBe(b);
  });

  it('normalizes token and text output with fixed semantics', () => {
    expect(normalizeOutput('  1\\r\\n2  ', 'tokens').value).toEqual(['1', '2']);
    expect(outputsEqual('1 2\\n', '1\\n2\\n', 'tokens').equal).toBe(true);
    expect(outputsEqual('1 2\\n', '1\\n2\\n', 'text').equal).toBe(false);
  });
});

describe('counterexample problem artifacts', () => {
  it('1000 oracle matches official sample and exhaustive small values', async () => {
    const problem = JSON.parse(await fs.readFile(path.join(repoRoot, 'problems/1000/problem.json'), 'utf8'));
    expect(solve1000(problem.samples[0].input)).toBe(problem.samples[0].output);

    for (let a = 1; a <= 9; a += 1) {
      for (let b = 1; b <= 9; b += 1) {
        expect(solve1000(`${a} ${b}\n`)).toBe(`${a + b}\n`);
      }
    }
  });

  it('9012 oracle matches official samples and exhaustive short strings', async () => {
    const problem = JSON.parse(await fs.readFile(path.join(repoRoot, 'problems/9012/problem.json'), 'utf8'));
    for (const sample of problem.samples) {
      expect(solve9012(sample.input)).toBe(sample.output);
    }

    for (let length = 1; length <= 8; length += 1) {
      for (const text of parenthesisStrings(length)) {
        expect(solve9012(`1\n${text}\n`)).toBe(`${expectedVps(text)}\n`);
      }
    }

    expect(solve9012('3\n()\n(\n)(\n')).toBe('YES\nNO\nNO\n');
  });

  it('10866 oracle matches official samples and handcrafted golden cases', async () => {
    const problem = JSON.parse(await fs.readFile(path.join(repoRoot, 'problems/10866/problem.json'), 'utf8'));
    for (const sample of problem.samples) {
      expect(solve10866(sample.input)).toBe(sample.output);
    }

    expect(solve10866('6\nfront\nback\npop_front\npop_back\nsize\nempty\n')).toBe('-1\n-1\n-1\n-1\n0\n1\n');
    expect(solve10866('8\npush_front 2\npush_back 3\nfront\nback\nsize\npop_back\npop_front\nempty\n')).toBe('2\n3\n2\n3\n2\n1\n');
  });

  it('generators produce inputs accepted by their oracles', () => {
    const artifacts = [
      [generate1000, solve1000],
      [generate9012, solve9012],
      [generate10866, solve10866],
    ];

    for (const [generate, solve] of artifacts) {
      const rng = createRng('artifact-smoke');
      for (let runIndex = 0; runIndex < 30; runIndex += 1) {
        const generated = generate({ rng, runIndex, problem: {} });
        expect(() => solve(generated.input, { problem: {} })).not.toThrow();
      }
    }
  });
});

describe('counterexample harness and CLI contracts', () => {
  it('returns not_found for a correct JS solution and keeps cwd clean per execution', async () => {
    const solution = await writeTempFile('correct-with-cwd-marker.js', `
const fs = require('fs');
const seen = fs.existsSync('marker');
fs.writeFileSync('marker', 'created');
const [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);
console.log(seen ? 999999 : a + b);
`);

    const report = await runCounterexample({
      rootDir: repoRoot,
      problemId: 1000,
      language: 'javascript',
      codePath: solution,
      runs: 2,
      seed: 'cwd-clean',
      timeoutMs: 1000,
      maxOutputBytes: 1024,
      shrink: false,
    });

    expect(report.status).toBe('not_found');
  });

  it('finds a JS counterexample and keeps --json stdout parseable', async () => {
    const solution = await writeTempFile('wrong.js', 'console.log(0);\n');
    const result = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', solution,
      '--runs', '10',
      '--seed', 'json-purity',
      '--json',
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe('');
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.status).toBe('counterexample_found');
    expect(parsed.counterexample).toMatchObject({
      failureKind: 'wrong_answer',
      runIndex: expect.any(Number),
      input: expect.any(String),
      expectedOutput: expect.any(String),
      actualOutput: expect.any(String),
    });
  });

  it('saves a replay case only when a counterexample is found', async () => {
    const solution = await writeTempFile('wrong.js', 'console.log(0);\n');
    const dir = await makeTempDir();
    const casePath = path.join(dir, 'ce.json');

    const result = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', solution,
      '--runs', '4',
      '--seed', 'save-case',
      '--save', casePath,
      '--json',
    ]);

    expect(result.code).toBe(1);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.save).toMatchObject({
      status: 'saved',
      path: casePath,
      overwritten: false,
    });

    const saved = JSON.parse(await fs.readFile(casePath, 'utf8'));
    expect(saved).toMatchObject({
      caseVersion: 1,
      kind: 'counterexample_replay_case',
      problemId: 1000,
      languageAgnostic: true,
      artifact: {
        artifactVersion: 1,
        compareMode: 'tokens',
      },
      source: {
        seed: 'save-case',
        runIndex: expect.any(Number),
      },
      counterexample: {
        input: expect.any(String),
        expectedOutput: expect.any(String),
        actualOutput: expect.any(String),
      },
    });

    const overwriteResult = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', solution,
      '--runs', '4',
      '--seed', 'save-case-overwrite',
      '--save', casePath,
      '--json',
    ]);
    expect(overwriteResult.code).toBe(1);
    expect(JSON.parse(overwriteResult.stdout).save.overwritten).toBe(true);
  });

  it('does not save files for non-counterexample outcomes', async () => {
    const correct = await writeTempFile('correct.js', correctAPlusBSource());
    const missing = path.join(await makeTempDir(), 'missing.js');
    const dir = await makeTempDir();
    const notFoundPath = path.join(dir, 'not-found.json');
    const unsupportedPath = path.join(dir, 'unsupported.json');
    const harnessErrorPath = path.join(dir, 'harness-error.json');

    const notFound = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', correct,
      '--runs', '2',
      '--seed', 'no-save-not-found',
      '--save', notFoundPath,
      '--json',
    ]);
    expect(notFound.code).toBe(0);
    expect(JSON.parse(notFound.stdout).save.status).toBe('skipped');
    await expect(fs.access(notFoundPath)).rejects.toThrow();

    const unsupported = await runCli([
      '--problem', '1003',
      '--lang', 'js',
      '--code', correct,
      '--runs', '1',
      '--seed', 'no-save-unsupported',
      '--save', unsupportedPath,
      '--json',
    ]);
    expect(unsupported.code).toBe(2);
    expect(JSON.parse(unsupported.stdout).save.status).toBe('skipped');
    await expect(fs.access(unsupportedPath)).rejects.toThrow();

    const harnessError = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', missing,
      '--runs', '1',
      '--seed', 'no-save-harness-error',
      '--save', harnessErrorPath,
      '--json',
    ]);
    expect(harnessError.code).toBe(3);
    expect(JSON.parse(harnessError.stdout).save.status).toBe('skipped');
    await expect(fs.access(harnessErrorPath)).rejects.toThrow();
  });

  it('replays a saved case against fixed and still-wrong solutions', async () => {
    const wrong = await writeTempFile('wrong.js', 'console.log(0);\n');
    const fixed = await writeTempFile('fixed.js', correctAPlusBSource());
    const dir = await makeTempDir();
    const casePath = path.join(dir, 'ce.json');

    const save = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', wrong,
      '--runs', '4',
      '--seed', 'replay-flow',
      '--save', casePath,
      '--json',
    ]);
    expect(save.code).toBe(1);

    const pass = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', fixed,
      '--json',
    ]);
    expect(pass.code).toBe(0);
    expect(JSON.parse(pass.stdout).status).toBe('replay_pass');

    const fail = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', wrong,
      '--json',
    ]);
    expect(fail.code).toBe(1);
    expect(JSON.parse(fail.stdout).status).toBe('replay_failed');
  });

  it('enforces replay output caps with a distinct exit code', async () => {
    const wrong = await writeTempFile('wrong.js', 'console.log(0);\n');
    const tooMuchOutput = await writeTempFile('too-much-output.js', `
process.stdout.write('x'.repeat(10000));
`);
    const dir = await makeTempDir();
    const casePath = path.join(dir, 'ce.json');

    const save = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', wrong,
      '--runs', '4',
      '--seed', 'replay-output-cap',
      '--save', casePath,
      '--json',
    ]);
    expect(save.code).toBe(1);

    const result = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', tooMuchOutput,
      '--max-output-bytes', '64',
      '--json',
    ]);

    expect(result.code).toBe(74);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe('user_code_output_limit');
    expect(parsed.actualOutput.length).toBeLessThanOrEqual(64);
  });

  it('replays a saved 10866 case against a fixed deque solution', async () => {
    const wrong = await writeTempFile('wrong-deque.js', 'console.log(0);\n');
    const fixed = await writeTempFile('fixed-deque.js', correctDequeSource());
    const dir = await makeTempDir();
    const casePath = path.join(dir, 'deque-ce.json');

    const save = await runCli([
      '--problem', '10866',
      '--lang', 'js',
      '--code', wrong,
      '--runs', '4',
      '--seed', 'deque-replay-flow',
      '--save', casePath,
      '--json',
    ]);
    expect(save.code).toBe(1);

    const pass = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', fixed,
      '--json',
    ]);
    expect(pass.code).toBe(0);
    expect(JSON.parse(pass.stdout).status).toBe('replay_pass');
  });

  it('rejects malformed replay cases before executing user code', async () => {
    const dir = await makeTempDir();
    const marker = path.join(dir, 'marker');
    const casePath = path.join(dir, 'malformed.json');
    await fs.writeFile(casePath, '{"kind":');
    const solution = await writeTempFile('marker.js', `
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
console.log(0);
`);

    const result = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', solution,
      '--json',
    ]);

    expect(result.code).toBe(65);
    expect(JSON.parse(result.stdout).status).toBe('invalid_case_file');
    await expect(fs.access(marker)).rejects.toThrow();
  });

  it('rejects incompatible replay cases before executing user code', async () => {
    const wrong = await writeTempFile('wrong.js', 'console.log(0);\n');
    const dir = await makeTempDir();
    const marker = path.join(dir, 'marker');
    const casePath = path.join(dir, 'ce.json');
    const solution = await writeTempFile('marker.js', `
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
console.log(0);
`);

    const save = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', wrong,
      '--runs', '4',
      '--seed', 'incompatible-case',
      '--save', casePath,
      '--json',
    ]);
    expect(save.code).toBe(1);

    const saved = JSON.parse(await fs.readFile(casePath, 'utf8'));
    saved.artifact.artifactVersion = 999;
    await fs.writeFile(casePath, `${JSON.stringify(saved, null, 2)}\n`);

    const result = await runReplayCli([
      '--case', casePath,
      '--lang', 'js',
      '--code', solution,
      '--json',
    ]);

    expect(result.code).toBe(66);
    expect(JSON.parse(result.stdout).status).toBe('incompatible_case_file');
    await expect(fs.access(marker)).rejects.toThrow();
  });

  it('prints self-test and support JSON reports', async () => {
    const selfTest = await runSelfTestCli(['--json']);
    expect(selfTest.code).toBe(0);
    const selfTestJson = JSON.parse(selfTest.stdout);
    expect(selfTestJson).toMatchObject({
      schemaVersion: 1,
      status: 'passed',
      summary: {
        total: 3,
        failed: 0,
      },
    });

    const support = await runSupportCli(['--json']);
    expect(support.code).toBe(0);
    const supportJson = JSON.parse(support.stdout);
    expect(supportJson.schemaVersion).toBe(1);
    expect(supportJson.problems.map((problem) => problem.problemId)).toEqual([1000, 9012, 10866]);
    expect(supportJson.problems.every((problem) => problem.generator && problem.oracle && problem.shrinker)).toBe(true);
  });

  it('uses exit code 0 for not_found', async () => {
    const solution = await writeTempFile('correct.js', correctAPlusBSource());
    const result = await runCli([
      '--problem', '1000',
      '--lang', 'javascript',
      '--code', solution,
      '--runs', '8',
      '--seed', 'correct',
      '--json',
    ]);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('not_found');
  });

  it('does not execute user code for unsupported problems', async () => {
    const dir = await makeTempDir();
    const marker = path.join(dir, 'marker');
    const solution = await writeTempFile('marker.js', `
const fs = require('fs');
fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
console.log('executed');
`);

    const result = await runCli([
      '--problem', '1003',
      '--lang', 'js',
      '--code', solution,
      '--runs', '1',
      '--seed', 'unsupported',
      '--json',
    ]);

    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout).status).toBe('unsupported');
    await expect(fs.access(marker)).rejects.toThrow();
  });

  it('reports missing code files as harness_error/missing_code_file', async () => {
    const missing = path.join(await makeTempDir(), 'missing.js');
    const result = await runCli([
      '--problem', '1000',
      '--lang', 'js',
      '--code', missing,
      '--runs', '1',
      '--seed', 'missing-code',
      '--json',
    ]);

    const parsed = JSON.parse(result.stdout);
    expect(result.code).toBe(3);
    expect(parsed.status).toBe('harness_error');
    expect(parsed.error.kind).toBe('missing_code_file');
    expect(parsed.counterexample).toBeNull();
  });

  it('uses exit code 64 for invalid arguments', async () => {
    const result = await runCli(['--problem', '1000']);
    expect(result.code).toBe(64);
    expect(result.stderr).toContain('--lang is required');
  });

  it('reports generator and oracle errors as harness_error', async () => {
    const solution = await writeTempFile('correct.js', correctAPlusBSource());
    const manifest = {
      supportLevel: 'full',
      artifactVersion: 1,
      compareMode: 'tokens',
    };

    const generatorReport = await runCounterexample({
      rootDir: repoRoot,
      problemId: 1000,
      language: 'javascript',
      codePath: solution,
      runs: 1,
      seed: 'generator-error',
      timeoutMs: 1000,
      maxOutputBytes: 1024,
      artifactLoader: async () => ({
        manifest,
        generator: { generateCase: () => { throw new Error('bad generator'); } },
        oracle: { solve: () => '0\n' },
        shrinker: null,
      }),
    });
    expect(generatorReport.status).toBe('harness_error');
    expect(generatorReport.error.kind).toBe('generator_error');

    const oracleReport = await runCounterexample({
      rootDir: repoRoot,
      problemId: 1000,
      language: 'javascript',
      codePath: solution,
      runs: 1,
      seed: 'oracle-error',
      timeoutMs: 1000,
      maxOutputBytes: 1024,
      artifactLoader: async () => ({
        manifest,
        generator: { generateCase: () => ({ input: '1 1\n', meta: {} }) },
        oracle: { solve: () => { throw new Error('bad oracle'); } },
        shrinker: null,
      }),
    });
    expect(oracleReport.status).toBe('harness_error');
    expect(oracleReport.error.kind).toBe('oracle_error');
  });

  it('reports missing python runtime as harness_error/missing_runtime', async () => {
    const solution = await writeTempFile('solution.py', 'print(0)\n');
    const report = await runCounterexample({
      rootDir: repoRoot,
      problemId: 1000,
      language: 'python',
      codePath: solution,
      runs: 1,
      seed: 'missing-runtime',
      timeoutMs: 1000,
      maxOutputBytes: 1024,
      runtimeCommands: {
        python: 'definitely-missing-python3-for-boj-ce',
      },
    });

    expect(report.status).toBe('harness_error');
    expect(report.error.kind).toBe('missing_runtime');
  });

  it('enforces output cap while streaming', async () => {
    const solution = await writeTempFile('too-much-output.js', `
process.stdout.write('x'.repeat(10000));
`);

    const report = await runCounterexample({
      rootDir: repoRoot,
      problemId: 1000,
      language: 'javascript',
      codePath: solution,
      runs: 1,
      seed: 'output-cap',
      timeoutMs: 1000,
      maxOutputBytes: 64,
      shrink: false,
    });

    expect(report.status).toBe('counterexample_found');
    expect(report.counterexample.failureKind).toBe('output_limit');
    expect(report.counterexample.outputTruncated).toBe(true);
    expect(report.counterexample.actualOutput.length).toBeLessThanOrEqual(64);
  });
});
