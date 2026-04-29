import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { runCounterexample } from './harness.mjs';
import { makeRandomSeed } from './rng.mjs';
import { EXIT_CODES, exitCodeForReport, makeBaseReport, writeReport } from './report.mjs';

const DEFAULT_RUNS = 100;
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

function usage() {
  return `Usage:
  node scripts/counterexample.mjs --problem <id> --lang <python|javascript> --code <path> [options]

Options:
  -p, --problem <id>         BOJ problem id
  -l, --lang <lang>          python|py|javascript|js
  -c, --code <path>          user solution file
  -r, --runs <n>             generated test count (default: ${DEFAULT_RUNS})
  -s, --seed <seed>          deterministic seed (default: generated)
      --json                 print exactly one JSON object to stdout
      --timeout-ms <n>       per-execution timeout (default: ${DEFAULT_TIMEOUT_MS})
      --max-output-bytes <n> combined stdout/stderr cap (default: ${DEFAULT_MAX_OUTPUT_BYTES})
      --no-shrink            skip counterexample minimization
      --help                 print this help

Security: user code is executed locally with best-effort process limits, not a full OS sandbox.
`;
}

function readValue(argv, index, name) {
  const value = argv[index + 1];
  if (value == null || value.startsWith('-')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function normalizeLanguage(language) {
  if (language === 'js' || language === 'javascript') {
    return 'javascript';
  }
  if (language === 'py' || language === 'python') {
    return 'python';
  }
  throw new Error(`unsupported language: ${language}`);
}

export function parseArgs(argv) {
  const options = {
    runs: DEFAULT_RUNS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
    json: false,
    shrink: true,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const equalsIndex = arg.indexOf('=');
    const flag = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg;
    const inlineValue = equalsIndex >= 0 ? arg.slice(equalsIndex + 1) : null;
    const value = inlineValue ?? (() => {
      if (
        flag === '--problem' ||
        flag === '-p' ||
        flag === '--lang' ||
        flag === '-l' ||
        flag === '--code' ||
        flag === '-c' ||
        flag === '--runs' ||
        flag === '-r' ||
        flag === '--seed' ||
        flag === '-s' ||
        flag === '--timeout-ms' ||
        flag === '--max-output-bytes'
      ) {
        const next = readValue(argv, i, flag);
        i += 1;
        return next;
      }
      return null;
    })();

    switch (flag) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--problem':
      case '-p':
        options.problemId = parseInteger(value, '--problem');
        break;
      case '--lang':
      case '-l':
        options.language = normalizeLanguage(value);
        break;
      case '--code':
      case '-c':
        options.codePath = value;
        break;
      case '--runs':
      case '-r':
        options.runs = parseInteger(value, '--runs');
        break;
      case '--seed':
      case '-s':
        options.seed = String(value);
        break;
      case '--timeout-ms':
        options.timeoutMs = parseInteger(value, '--timeout-ms');
        break;
      case '--max-output-bytes':
        options.maxOutputBytes = parseInteger(value, '--max-output-bytes');
        break;
      case '--json':
        options.json = true;
        break;
      case '--no-shrink':
        options.shrink = false;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (!options.problemId) {
    throw new Error('--problem is required');
  }
  if (!options.language) {
    throw new Error('--lang is required');
  }
  if (!options.codePath) {
    throw new Error('--code is required');
  }

  options.seed ??= makeRandomSeed();
  return options;
}

async function readableFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }
    await fs.access(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function missingCodeFileReport({ problemId, language, codePath, runs, seed, timeoutMs, maxOutputBytes }) {
  return makeBaseReport({
    status: 'harness_error',
    problemId,
    language,
    codePath,
    runsRequested: runs,
    runsExecuted: 0,
    seed,
    timeoutMs,
    maxOutputBytes,
    message: `Code file does not exist or is not readable: ${codePath}`,
    error: {
      kind: 'missing_code_file',
      message: `Code file does not exist or is not readable: ${codePath}`,
    },
  });
}

export async function runCli(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n\n${usage()}`);
    return EXIT_CODES.invalid_args;
  }

  if (options.help) {
    stdout.write(usage());
    return EXIT_CODES.not_found;
  }

  const absoluteCodePath = path.resolve(cwd, options.codePath);
  if (!(await readableFile(absoluteCodePath))) {
    const report = missingCodeFileReport({
      problemId: options.problemId,
      language: options.language,
      codePath: absoluteCodePath,
      runs: options.runs,
      seed: options.seed,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
    });
    writeReport(report, { json: options.json, stdout });
    return EXIT_CODES.harness_error;
  }

  const report = await runCounterexample({
    rootDir: cwd,
    problemId: options.problemId,
    language: options.language,
    codePath: absoluteCodePath,
    runs: options.runs,
    seed: options.seed,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes,
    shrink: options.shrink,
  });

  writeReport(report, { json: options.json, stdout });
  return exitCodeForReport(report);
}
