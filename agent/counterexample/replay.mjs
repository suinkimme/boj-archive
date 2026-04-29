import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { REPLAY_EXIT_CODES } from './exit-codes.mjs';
import { outputsEqual } from './normalize-output.mjs';
import { loadProblemArtifact } from './registry.mjs';
import { cleanupTempRoot, createTempRoot, runUserCode } from './run-user-code.mjs';
import { normalizeLanguage } from './cli.mjs';
import {
  readReplayCaseFile,
  validateReplayCaseCompatibility,
  validateReplayCaseStructure,
} from './case-file.mjs';

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

function usage() {
  return `Usage:
  node scripts/counterexample-replay.mjs --case <path> --lang <python|javascript> --code <path> [options]

Options:
      --case <path>          saved replay case JSON
  -l, --lang <lang>          python|py|javascript|js
  -c, --code <path>          user solution file
      --json                 print exactly one JSON object to stdout
      --timeout-ms <n>       per-execution timeout (default: ${DEFAULT_TIMEOUT_MS})
      --max-output-bytes <n> combined stdout/stderr cap (default: ${DEFAULT_MAX_OUTPUT_BYTES})
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

function parseArgs(argv) {
  const options = {
    json: false,
    help: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const equalsIndex = arg.indexOf('=');
    const flag = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg;
    const inlineValue = equalsIndex >= 0 ? arg.slice(equalsIndex + 1) : null;
    const value = inlineValue ?? (() => {
      if (
        flag === '--case' ||
        flag === '--lang' ||
        flag === '-l' ||
        flag === '--code' ||
        flag === '-c' ||
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
      case '--case':
        options.casePath = value;
        break;
      case '--lang':
      case '-l':
        options.language = normalizeLanguage(value);
        break;
      case '--code':
      case '-c':
        options.codePath = value;
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
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (!options.casePath) {
    throw new Error('--case is required');
  }
  if (!options.language) {
    throw new Error('--lang is required');
  }
  if (!options.codePath) {
    throw new Error('--code is required');
  }

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

async function loadProblem(rootDir, problemId) {
  const problemPath = path.join(rootDir, 'problems', String(problemId), 'problem.json');
  const raw = await fs.readFile(problemPath, 'utf8');
  return JSON.parse(raw);
}

function makeBaseReport({
  status,
  casePath,
  caseFile = null,
  language = null,
  codePath = null,
  timeoutMs,
  maxOutputBytes,
  message,
  expectedOutput = null,
  actualOutput = null,
  stderr = '',
  comparison = null,
  userResult = null,
  error = null,
  warnings = [],
}) {
  return {
    schemaVersion: 1,
    status,
    case: {
      path: casePath,
      problemId: caseFile?.problemId ?? null,
      createdAt: caseFile?.createdAt ?? null,
      seed: caseFile?.source?.seed ?? null,
      runIndex: caseFile?.source?.runIndex ?? null,
      artifactVersion: caseFile?.artifact?.artifactVersion ?? null,
      compareMode: caseFile?.artifact?.compareMode ?? null,
    },
    run: {
      language,
      codePath,
    },
    limits: {
      timeoutMs,
      maxOutputBytes,
    },
    result: {
      message,
    },
    expectedOutput,
    actualOutput,
    stderr,
    comparison,
    userResult,
    error,
    warnings,
  };
}

function invalidCaseReport({ casePath, timeoutMs, maxOutputBytes, error }) {
  return makeBaseReport({
    status: 'invalid_case_file',
    casePath,
    timeoutMs,
    maxOutputBytes,
    message: error.message,
    error,
  });
}

function incompatibleCaseReport({ casePath, caseFile, language, codePath, timeoutMs, maxOutputBytes, error, comparison = null }) {
  return makeBaseReport({
    status: 'incompatible_case_file',
    casePath,
    caseFile,
    language,
    codePath,
    timeoutMs,
    maxOutputBytes,
    message: error.message,
    error,
    comparison,
  });
}

function harnessErrorReport({ casePath, caseFile = null, language, codePath, timeoutMs, maxOutputBytes, kind, message }) {
  return makeBaseReport({
    status: 'harness_error',
    casePath,
    caseFile,
    language,
    codePath,
    timeoutMs,
    maxOutputBytes,
    message,
    error: {
      kind,
      message,
    },
  });
}

function oracleErrorReport({ casePath, caseFile, language, codePath, timeoutMs, maxOutputBytes, message }) {
  return makeBaseReport({
    status: 'oracle_error',
    casePath,
    caseFile,
    language,
    codePath,
    timeoutMs,
    maxOutputBytes,
    message,
    error: {
      kind: 'oracle_error',
      message,
    },
  });
}

function indentBlock(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  if (normalized.length === 0) {
    return '(empty)';
  }
  return normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
}

function formatHumanReport(report) {
  const lines = [
    'Counterexample Replay',
    `Case: ${report.case.path}`,
  ];

  if (report.case.problemId != null) {
    lines.push(`Problem: ${report.case.problemId}`);
  }
  if (report.case.seed != null) {
    lines.push(`Seed: ${report.case.seed}, run #${report.case.runIndex}`);
  }
  if (report.run.language) {
    lines.push(`Language: ${report.run.language}`);
  }
  lines.push('');

  if (report.status === 'replay_pass') {
    lines.push('PASS: current output matches the saved counterexample expected output.');
  } else if (report.status === 'replay_failed') {
    lines.push(
      'FAIL: current output does not match the saved counterexample expected output.',
      '',
      'Expected:',
      indentBlock(report.expectedOutput),
      '',
      'Actual:',
      indentBlock(report.actualOutput),
    );
    if (report.stderr) {
      lines.push('', 'Stderr:', indentBlock(report.stderr));
    }
  } else if (report.status === 'user_code_timeout') {
    lines.push('FAIL: user code timed out.');
  } else if (report.status === 'user_code_output_limit') {
    lines.push('FAIL: user code exceeded the output limit.');
  } else if (report.status === 'user_code_runtime_error') {
    lines.push('FAIL: user code exited with a runtime error.');
    if (report.stderr) {
      lines.push('', 'Stderr:', indentBlock(report.stderr));
    }
  } else if (report.status === 'invalid_case_file') {
    lines.push(`Invalid replay case: ${report.error?.message ?? report.result.message}`);
  } else if (report.status === 'incompatible_case_file') {
    lines.push(`Incompatible replay case: ${report.error?.message ?? report.result.message}`);
  } else if (report.status === 'oracle_error') {
    lines.push(`Oracle error: ${report.error?.message ?? report.result.message}`);
  } else {
    lines.push(`Harness error: ${report.error?.message ?? report.result.message}`);
  }

  if (report.warnings?.length) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function writeReplayReport(report, { json, stdout }) {
  if (json) {
    stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  stdout.write(formatHumanReport(report));
}

function exitCodeForReplayReport(report) {
  switch (report.status) {
    case 'replay_pass':
      return REPLAY_EXIT_CODES.success;
    case 'replay_failed':
      return REPLAY_EXIT_CODES.replay_failed;
    case 'invalid_case_file':
      return REPLAY_EXIT_CODES.invalid_case_file;
    case 'incompatible_case_file':
      return REPLAY_EXIT_CODES.incompatible_case_file;
    case 'oracle_error':
      return REPLAY_EXIT_CODES.oracle_error;
    case 'user_code_timeout':
      return REPLAY_EXIT_CODES.user_code_timeout;
    case 'user_code_runtime_error':
      return REPLAY_EXIT_CODES.user_code_runtime_error;
    case 'user_code_output_limit':
      return REPLAY_EXIT_CODES.user_code_output_limit;
    default:
      return REPLAY_EXIT_CODES.harness_error;
  }
}

export async function runReplayCli(argv, { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n\n${usage()}`);
    return REPLAY_EXIT_CODES.invalid_args;
  }

  if (options.help) {
    stdout.write(usage());
    return REPLAY_EXIT_CODES.success;
  }

  const absoluteCasePath = path.resolve(cwd, options.casePath);
  const absoluteCodePath = path.resolve(cwd, options.codePath);

  let report;
  const readResult = await readReplayCaseFile(absoluteCasePath);
  if (!readResult.ok) {
    report = invalidCaseReport({
      casePath: absoluteCasePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      error: readResult.error,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const caseFile = readResult.caseFile;
  const structural = validateReplayCaseStructure(caseFile);
  if (!structural.ok) {
    report = invalidCaseReport({
      casePath: absoluteCasePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      error: {
        kind: 'invalid_case_structure',
        message: structural.errors.join('; '),
        errors: structural.errors,
      },
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  let artifact;
  try {
    artifact = await loadProblemArtifact(caseFile.problemId);
  } catch (error) {
    report = harnessErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      kind: 'artifact_load_error',
      message: `Could not load counterexample artifact for ${caseFile.problemId}: ${error.message}`,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const compatible = validateReplayCaseCompatibility(caseFile, artifact);
  if (!compatible.ok) {
    report = incompatibleCaseReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      error: compatible.error,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  if (!(await readableFile(absoluteCodePath))) {
    report = harnessErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      kind: 'missing_code_file',
      message: `Code file does not exist or is not readable: ${absoluteCodePath}`,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  let problem;
  try {
    problem = await loadProblem(cwd, caseFile.problemId);
  } catch (error) {
    report = harnessErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      kind: 'missing_problem_data',
      message: `Could not load problem data for ${caseFile.problemId}: ${error.message}`,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const compareMode = artifact.manifest.compareMode ?? 'tokens';
  let expectedOutput;
  try {
    expectedOutput = artifact.oracle.solve(caseFile.counterexample.input, { problem });
  } catch (error) {
    report = oracleErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      message: error.message,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const staleComparison = outputsEqual(caseFile.counterexample.expectedOutput, expectedOutput, compareMode);
  if (!staleComparison.equal) {
    report = incompatibleCaseReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      error: {
        kind: 'stale_expected_output',
        message: 'Current oracle output differs from the saved replay case expected output.',
      },
      comparison: {
        normalizedExpected: staleComparison.normalizedExpected.display,
        normalizedActual: staleComparison.normalizedActual.display,
      },
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const warnings = [];
  let tempRoot;
  let userResult;
  try {
    tempRoot = await createTempRoot();
    userResult = await runUserCode({
      language: options.language,
      codePath: absoluteCodePath,
      input: caseFile.counterexample.input,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      tempRoot,
      executionLabel: 'replay',
    });
  } catch (error) {
    report = harnessErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      kind: 'runner_error',
      message: error.message,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  } finally {
    if (tempRoot) {
      const cleanupWarning = await cleanupTempRoot(tempRoot);
      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }
  }

  if (userResult.cleanupWarning) {
    warnings.push(userResult.cleanupWarning);
  }

  if (userResult.errorKind) {
    report = harnessErrorReport({
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      kind: userResult.errorKind,
      message: userResult.message,
    });
    report.warnings = warnings;
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  if (userResult.timedOut) {
    report = makeBaseReport({
      status: 'user_code_timeout',
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      message: 'User code timed out during replay.',
      expectedOutput,
      actualOutput: userResult.stdout,
      stderr: userResult.stderr,
      userResult,
      warnings,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  if (userResult.outputLimitExceeded) {
    report = makeBaseReport({
      status: 'user_code_output_limit',
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      message: 'User code exceeded the output limit during replay.',
      expectedOutput,
      actualOutput: userResult.stdout,
      stderr: userResult.stderr,
      userResult,
      warnings,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  if (userResult.exitCode !== 0) {
    report = makeBaseReport({
      status: 'user_code_runtime_error',
      casePath: absoluteCasePath,
      caseFile,
      language: options.language,
      codePath: absoluteCodePath,
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      message: `User code exited with code ${userResult.exitCode}.`,
      expectedOutput,
      actualOutput: userResult.stdout,
      stderr: userResult.stderr,
      userResult,
      warnings,
    });
    writeReplayReport(report, { json: options.json, stdout });
    return exitCodeForReplayReport(report);
  }

  const comparison = outputsEqual(expectedOutput, userResult.stdout, compareMode);
  report = makeBaseReport({
    status: comparison.equal ? 'replay_pass' : 'replay_failed',
    casePath: absoluteCasePath,
    caseFile,
    language: options.language,
    codePath: absoluteCodePath,
    timeoutMs: options.timeoutMs,
    maxOutputBytes: options.maxOutputBytes,
    message: comparison.equal
      ? 'Current output matches the saved counterexample expected output.'
      : 'Current output does not match the saved counterexample expected output.',
    expectedOutput,
    actualOutput: userResult.stdout,
    stderr: userResult.stderr,
    comparison: {
      normalizedExpected: comparison.normalizedExpected.display,
      normalizedActual: comparison.normalizedActual.display,
    },
    userResult,
    warnings,
  });

  writeReplayReport(report, { json: options.json, stdout });
  return exitCodeForReplayReport(report);
}
