import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRng } from './rng.mjs';
import { outputsEqual, normalizeOutput } from './normalize-output.mjs';
import { loadProblemArtifact } from './registry.mjs';
import { cleanupTempRoot, createTempRoot, runUserCode } from './run-user-code.mjs';
import { makeBaseReport } from './report.mjs';

function harnessErrorReport({
  kind,
  message,
  problemId,
  problemTitle = null,
  supportLevel = null,
  artifactVersion = null,
  language,
  codePath,
  runsRequested,
  runsExecuted = 0,
  seed,
  timeoutMs,
  maxOutputBytes,
  warnings = [],
  extra = {},
}) {
  return makeBaseReport({
    status: 'harness_error',
    problemId,
    problemTitle,
    supportLevel,
    artifactVersion,
    language,
    codePath,
    runsRequested,
    runsExecuted,
    seed,
    timeoutMs,
    maxOutputBytes,
    message,
    error: {
      kind,
      message,
      ...extra,
    },
    warnings,
  });
}

async function loadProblem(rootDir, problemId) {
  const problemPath = path.join(rootDir, 'problems', String(problemId), 'problem.json');
  const raw = await fs.readFile(problemPath, 'utf8');
  return JSON.parse(raw);
}

function makeCounterexample({
  runIndex,
  failureKind,
  input,
  expectedOutput,
  actualOutput,
  stderr,
  userResult,
  compareMode,
  caseMeta,
  shrunk = false,
  originalInput = null,
}) {
  const normalizedExpected = normalizeOutput(expectedOutput, compareMode);
  const normalizedActual = normalizeOutput(actualOutput, compareMode);

  return {
    runIndex,
    failureKind,
    input,
    expectedOutput,
    actualOutput,
    normalizedExpected: normalizedExpected.display,
    normalizedActual: normalizedActual.display,
    stderr,
    exitCode: userResult.exitCode,
    signal: userResult.signal,
    timedOut: userResult.timedOut,
    outputTruncated: userResult.outputTruncated,
    shrunk,
    originalInput,
    caseMeta,
  };
}

function classifyUserResult({ userResult, expectedOutput, input, runIndex, compareMode, caseMeta }) {
  if (userResult.errorKind) {
    return {
      harnessError: {
        kind: userResult.errorKind,
        message: userResult.message,
        extra: userResult.runtime ? { runtime: userResult.runtime } : {},
      },
    };
  }

  if (userResult.timedOut) {
    return {
      failure: makeCounterexample({
        runIndex,
        failureKind: 'timeout',
        input,
        expectedOutput,
        actualOutput: userResult.stdout,
        stderr: userResult.stderr,
        userResult,
        compareMode,
        caseMeta,
      }),
    };
  }

  if (userResult.outputLimitExceeded) {
    return {
      failure: makeCounterexample({
        runIndex,
        failureKind: 'output_limit',
        input,
        expectedOutput,
        actualOutput: userResult.stdout,
        stderr: userResult.stderr,
        userResult,
        compareMode,
        caseMeta,
      }),
    };
  }

  if (userResult.exitCode !== 0) {
    return {
      failure: makeCounterexample({
        runIndex,
        failureKind: 'runtime_error',
        input,
        expectedOutput,
        actualOutput: userResult.stdout,
        stderr: userResult.stderr,
        userResult,
        compareMode,
        caseMeta,
      }),
    };
  }

  const comparison = outputsEqual(expectedOutput, userResult.stdout, compareMode);
  if (!comparison.equal) {
    return {
      failure: {
        ...makeCounterexample({
          runIndex,
          failureKind: 'wrong_answer',
          input,
          expectedOutput,
          actualOutput: userResult.stdout,
          stderr: userResult.stderr,
          userResult,
          compareMode,
          caseMeta,
        }),
        normalizedExpected: comparison.normalizedExpected.display,
        normalizedActual: comparison.normalizedActual.display,
      },
    };
  }

  return { passed: true };
}

async function evaluateInput({
  input,
  caseMeta,
  runIndex,
  artifact,
  problem,
  language,
  codePath,
  timeoutMs,
  maxOutputBytes,
  tempRoot,
  executionLabel,
  runtimeCommands,
}) {
  const compareMode = artifact.manifest.compareMode ?? 'tokens';
  let expectedOutput;

  try {
    expectedOutput = artifact.oracle.solve(input, { problem });
  } catch (error) {
    return {
      harnessError: {
        kind: 'oracle_error',
        message: error.message,
      },
    };
  }

  const userResult = await runUserCode({
    language,
    codePath,
    input,
    timeoutMs,
    maxOutputBytes,
    tempRoot,
    executionLabel,
    runtimeCommands,
  });

  return classifyUserResult({
    userResult,
    expectedOutput,
    input,
    runIndex,
    compareMode,
    caseMeta,
  });
}

async function shrinkFailure({
  failure,
  artifact,
  problem,
  language,
  codePath,
  timeoutMs,
  maxOutputBytes,
  tempRoot,
  runtimeCommands,
  warnings,
}) {
  if (!artifact.shrinker || typeof artifact.shrinker.shrinkCandidates !== 'function') {
    return failure;
  }

  let current = failure;
  const originalInput = failure.originalInput ?? failure.input;
  let checks = 0;
  const maxChecks = 100;

  while (checks < maxChecks) {
    let candidates;
    try {
      candidates = artifact.shrinker.shrinkCandidates({
        input: current.input,
        failure: current,
        problem,
      });
    } catch (error) {
      warnings.push(`Shrinker failed: ${error.message}`);
      return current;
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return current;
    }

    let accepted = false;
    for (const candidate of candidates) {
      if (checks >= maxChecks) {
        break;
      }
      checks += 1;

      const candidateInput = typeof candidate === 'string' ? candidate : candidate.input;
      const result = await evaluateInput({
        input: candidateInput,
        caseMeta: current.caseMeta,
        runIndex: current.runIndex,
        artifact,
        problem,
        language,
        codePath,
        timeoutMs,
        maxOutputBytes,
        tempRoot,
        executionLabel: `shrink-${current.runIndex}-${checks}`,
        runtimeCommands,
      });

      if (result.failure?.failureKind === current.failureKind) {
        current = {
          ...result.failure,
          shrunk: true,
          originalInput,
        };
        accepted = true;
        break;
      }
    }

    if (!accepted) {
      return current;
    }
  }

  return current;
}

export async function runCounterexample({
  rootDir = process.cwd(),
  problemId,
  language,
  codePath,
  runs,
  seed,
  timeoutMs,
  maxOutputBytes,
  shrink = true,
  artifactLoader = loadProblemArtifact,
  runtimeCommands = {},
}) {
  const warnings = [];
  let problem;
  let artifact;
  let tempRoot;
  let report;

  try {
    problem = await loadProblem(rootDir, problemId);
  } catch (error) {
    return harnessErrorReport({
      kind: 'missing_problem_data',
      message: `Could not load problem data for ${problemId}: ${error.message}`,
      problemId,
      language,
      codePath,
      runsRequested: runs,
      seed,
      timeoutMs,
      maxOutputBytes,
    });
  }

  try {
    artifact = await artifactLoader(problemId);
  } catch (error) {
    return harnessErrorReport({
      kind: 'runner_error',
      message: `Could not load counterexample artifact for ${problemId}: ${error.message}`,
      problemId,
      problemTitle: problem.title,
      language,
      codePath,
      runsRequested: runs,
      seed,
      timeoutMs,
      maxOutputBytes,
    });
  }

  if (!artifact) {
    return makeBaseReport({
      status: 'unsupported',
      problemId,
      problemTitle: problem.title,
      supportLevel: 'unsupported',
      artifactVersion: null,
      language,
      codePath,
      runsRequested: runs,
      runsExecuted: 0,
      seed,
      timeoutMs,
      maxOutputBytes,
      message: `No counterexample artifact is available for problem ${problemId}.`,
      error: {
        kind: 'unsupported_problem',
        message: `No counterexample artifact is available for problem ${problemId}.`,
      },
    });
  }

  try {
    tempRoot = await createTempRoot();
  } catch (error) {
    return harnessErrorReport({
      kind: 'runner_error',
      message: `Could not create temporary directory: ${error.message}`,
      problemId,
      problemTitle: problem.title,
      supportLevel: artifact.manifest.supportLevel,
      artifactVersion: artifact.manifest.artifactVersion,
      language,
      codePath,
      runsRequested: runs,
      seed,
      timeoutMs,
      maxOutputBytes,
    });
  }

  try {
    const rng = createRng(seed);
    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      let generated;
      try {
        generated = artifact.generator.generateCase({ rng, runIndex, problem });
      } catch (error) {
        report = harnessErrorReport({
          kind: 'generator_error',
          message: error.message,
          problemId,
          problemTitle: problem.title,
          supportLevel: artifact.manifest.supportLevel,
          artifactVersion: artifact.manifest.artifactVersion,
          language,
          codePath,
          runsRequested: runs,
          runsExecuted: runIndex,
          seed,
          timeoutMs,
          maxOutputBytes,
          warnings,
        });
        break;
      }

      const result = await evaluateInput({
        input: generated.input,
        caseMeta: generated.meta ?? {},
        runIndex,
        artifact,
        problem,
        language,
        codePath,
        timeoutMs,
        maxOutputBytes,
        tempRoot,
        executionLabel: `run-${runIndex}`,
        runtimeCommands,
      });

      if (result.harnessError) {
        report = harnessErrorReport({
          kind: result.harnessError.kind,
          message: result.harnessError.message,
          problemId,
          problemTitle: problem.title,
          supportLevel: artifact.manifest.supportLevel,
          artifactVersion: artifact.manifest.artifactVersion,
          language,
          codePath,
          runsRequested: runs,
          runsExecuted: runIndex,
          seed,
          timeoutMs,
          maxOutputBytes,
          warnings,
          extra: result.harnessError.extra,
        });
        break;
      }

      if (result.failure) {
        const counterexample = shrink
          ? await shrinkFailure({
              failure: result.failure,
              artifact,
              problem,
              language,
              codePath,
              timeoutMs,
              maxOutputBytes,
              tempRoot,
              runtimeCommands,
              warnings,
            })
          : result.failure;

        report = makeBaseReport({
          status: 'counterexample_found',
          problemId,
          problemTitle: problem.title,
          supportLevel: artifact.manifest.supportLevel,
          artifactVersion: artifact.manifest.artifactVersion,
          language,
          codePath,
          runsRequested: runs,
          runsExecuted: runIndex + 1,
          seed,
          timeoutMs,
          maxOutputBytes,
          message: 'Found counterexample.',
          counterexample,
          warnings,
        });
        break;
      }
    }

    if (!report) {
      report = makeBaseReport({
        status: 'not_found',
        problemId,
        problemTitle: problem.title,
        supportLevel: artifact.manifest.supportLevel,
        artifactVersion: artifact.manifest.artifactVersion,
        language,
        codePath,
        runsRequested: runs,
        runsExecuted: runs,
        seed,
        timeoutMs,
        maxOutputBytes,
        message: 'No counterexample found in this strategy. This does not guarantee correctness.',
        warnings,
      });
    }
  } finally {
    if (tempRoot) {
      const cleanupWarning = await cleanupTempRoot(tempRoot);
      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }
  }

  report.warnings = warnings;
  return report;
}
