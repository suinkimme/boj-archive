import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRng } from './rng.mjs';
import { outputsEqual } from './normalize-output.mjs';
import { SELF_TEST_EXIT_CODES } from './exit-codes.mjs';
import { listProblemArtifacts, loadProblemArtifact } from './registry.mjs';

const DEFAULT_GENERATOR_RUNS = 20;

function usage() {
  return `Usage:
  node scripts/counterexample-self-test.mjs [options]

Options:
      --json   print exactly one JSON object to stdout
      --help   print this help
`;
}

function parseArgs(argv) {
  const options = {
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function addError(result, kind, message, extra = {}) {
  result.errors.push({
    kind,
    message,
    ...extra,
  });
}

function validateManifest(metadata, result) {
  const manifest = metadata.manifest;
  if (!manifest) {
    addError(result, 'manifest_error', metadata.manifestError ?? 'manifest could not be loaded');
    return false;
  }

  if (!Number.isInteger(manifest.problemId) || manifest.problemId <= 0) {
    addError(result, 'manifest_error', 'manifest.problemId must be a positive integer');
  }
  if (manifest.problemId !== metadata.problemId) {
    addError(result, 'manifest_error', `manifest.problemId ${manifest.problemId} does not match directory ${metadata.problemId}`);
  }
  if (typeof manifest.title !== 'string') {
    addError(result, 'manifest_error', 'manifest.title must be a string');
  }
  if (typeof manifest.supportLevel !== 'string') {
    addError(result, 'manifest_error', 'manifest.supportLevel must be a string');
  }
  if (!Number.isInteger(manifest.artifactVersion) || manifest.artifactVersion <= 0) {
    addError(result, 'manifest_error', 'manifest.artifactVersion must be a positive integer');
  }
  if (typeof manifest.compareMode !== 'string') {
    addError(result, 'manifest_error', 'manifest.compareMode must be a string');
  }
  if (typeof manifest.oracleKind !== 'string') {
    addError(result, 'manifest_error', 'manifest.oracleKind must be a string');
  }
  if (!Array.isArray(manifest.strategies) || manifest.strategies.some((strategy) => typeof strategy !== 'string')) {
    addError(result, 'manifest_error', 'manifest.strategies must be an array of strings');
  }
  if (!metadata.files.generator) {
    addError(result, 'manifest_error', 'generator.mjs is missing');
  }
  if (!metadata.files.oracle) {
    addError(result, 'manifest_error', 'oracle.mjs is missing');
  }

  return result.errors.length === 0;
}

async function loadProblem(rootDir, problemId) {
  const problemPath = path.join(rootDir, 'problems', String(problemId), 'problem.json');
  return JSON.parse(await fs.readFile(problemPath, 'utf8'));
}

async function runArtifactSelfTest(metadata, { rootDir, generatorRuns }) {
  const result = {
    problemId: metadata.problemId,
    title: metadata.manifest?.title ?? null,
    supportLevel: metadata.manifest?.supportLevel ?? null,
    artifactVersion: metadata.manifest?.artifactVersion ?? null,
    status: 'passed',
    samples: {
      total: 0,
      passed: 0,
    },
    generator: {
      runs: 0,
      passed: false,
    },
    shrinker: {
      present: metadata.files.shrinker,
      checked: false,
      passed: !metadata.files.shrinker,
    },
    errors: [],
  };

  validateManifest(metadata, result);
  if (result.errors.length) {
    result.status = 'failed';
    return result;
  }

  let artifact;
  try {
    artifact = await loadProblemArtifact(metadata.problemId);
  } catch (error) {
    addError(result, 'artifact_load_error', error.message);
    result.status = 'failed';
    return result;
  }

  let problem;
  try {
    problem = await loadProblem(rootDir, metadata.problemId);
  } catch (error) {
    addError(result, 'problem_data_error', `Could not load problem data: ${error.message}`);
    result.status = 'failed';
    return result;
  }

  const compareMode = artifact.manifest.compareMode ?? 'tokens';
  const samples = Array.isArray(problem.samples) ? problem.samples : [];
  result.samples.total = samples.length;

  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const sample = samples[sampleIndex];
    let actual;
    try {
      actual = artifact.oracle.solve(sample.input, { problem });
    } catch (error) {
      addError(result, 'oracle_error', `Oracle threw on sample ${sampleIndex}: ${error.message}`, { sampleIndex });
      continue;
    }

    const comparison = outputsEqual(sample.output, actual, compareMode);
    if (comparison.equal) {
      result.samples.passed += 1;
    } else {
      addError(result, 'sample_mismatch', `Oracle output did not match sample ${sampleIndex}`, {
        sampleIndex,
        normalizedExpected: comparison.normalizedExpected.display,
        normalizedActual: comparison.normalizedActual.display,
      });
    }
  }

  const rng = createRng(`self-test:${metadata.problemId}`);
  const generatedInputs = [];
  for (let runIndex = 0; runIndex < generatorRuns; runIndex += 1) {
    let generated;
    try {
      generated = artifact.generator.generateCase({ rng, runIndex, problem });
    } catch (error) {
      addError(result, 'generator_error', `Generator threw at run ${runIndex}: ${error.message}`, { runIndex });
      continue;
    }

    if (!generated || typeof generated.input !== 'string') {
      addError(result, 'generator_error', `Generator returned invalid case at run ${runIndex}`, { runIndex });
      continue;
    }

    generatedInputs.push(generated.input);

    try {
      const oracleOutput = artifact.oracle.solve(generated.input, { problem });
      if (typeof oracleOutput !== 'string') {
        addError(result, 'oracle_error', `Oracle returned non-string output for generated run ${runIndex}`, { runIndex });
      }
    } catch (error) {
      addError(result, 'oracle_error', `Oracle threw on generated run ${runIndex}: ${error.message}`, { runIndex });
    }

    result.generator.runs += 1;
  }
  result.generator.passed = result.generator.runs === generatorRuns;

  if (artifact.shrinker?.shrinkCandidates) {
    result.shrinker.checked = true;
    const shrinkInput = generatedInputs[0] ?? samples[0]?.input ?? '';
    try {
      const candidates = artifact.shrinker.shrinkCandidates({
        input: shrinkInput,
        failure: {
          failureKind: 'wrong_answer',
          input: shrinkInput,
        },
        problem,
      });
      if (Array.isArray(candidates)) {
        result.shrinker.passed = true;
      } else {
        addError(result, 'shrinker_error', 'Shrinker did not return an array');
      }
    } catch (error) {
      addError(result, 'shrinker_error', `Shrinker threw: ${error.message}`);
    }
  }

  result.status = result.errors.length ? 'failed' : 'passed';
  return result;
}

function makeReport(results) {
  const failed = results.filter((result) => result.status !== 'passed');
  return {
    schemaVersion: 1,
    status: failed.length ? 'failed' : 'passed',
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
    },
    problems: results,
  };
}

function formatHumanReport(report) {
  const lines = [
    'Counterexample Artifact Self-Test',
    `Status: ${report.status}`,
    `Problems: ${report.summary.passed}/${report.summary.total} passed`,
    '',
  ];

  for (const problem of report.problems) {
    lines.push(
      `${problem.status === 'passed' ? 'PASS' : 'FAIL'} ${problem.problemId} ${problem.title ?? '(unknown title)'}`,
      `  samples: ${problem.samples.passed}/${problem.samples.total}`,
      `  generator: ${problem.generator.runs} runs ${problem.generator.passed ? 'passed' : 'failed'}`,
      `  shrinker: ${problem.shrinker.present ? (problem.shrinker.passed ? 'passed' : 'failed') : 'not present'}`,
    );

    for (const error of problem.errors) {
      lines.push(`  error: ${error.kind}: ${error.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function exitCodeForSelfTestReport(report) {
  if (report.status === 'passed') {
    return SELF_TEST_EXIT_CODES.success;
  }
  if (report.problems.some((problem) => problem.errors.some((error) => error.kind === 'oracle_error'))) {
    return SELF_TEST_EXIT_CODES.oracle_error;
  }
  return SELF_TEST_EXIT_CODES.self_test_failed;
}

export async function runSelfTestCli(
  argv,
  { rootDir = process.cwd(), stdout = process.stdout, stderr = process.stderr, generatorRuns = DEFAULT_GENERATOR_RUNS } = {},
) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n\n${usage()}`);
    return SELF_TEST_EXIT_CODES.invalid_args;
  }

  if (options.help) {
    stdout.write(usage());
    return SELF_TEST_EXIT_CODES.success;
  }

  let metadata;
  try {
    metadata = await listProblemArtifacts();
  } catch (error) {
    const report = {
      schemaVersion: 1,
      status: 'harness_error',
      error: {
        kind: 'artifact_list_error',
        message: error.message,
      },
    };
    if (options.json) {
      stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      stderr.write(`Self-test error: ${error.message}\n`);
    }
    return SELF_TEST_EXIT_CODES.harness_error;
  }

  const results = [];
  for (const item of metadata) {
    results.push(await runArtifactSelfTest(item, { rootDir, generatorRuns }));
  }

  const report = makeReport(results);
  if (options.json) {
    stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    stdout.write(formatHumanReport(report));
  }

  return exitCodeForSelfTestReport(report);
}
