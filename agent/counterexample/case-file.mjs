import { promises as fs } from 'node:fs';
import path from 'node:path';

export const REPLAY_CASE_VERSION = 1;
export const REPLAY_CASE_KIND = 'counterexample_replay_case';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, pathName, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${pathName} must be an object`);
    return null;
  }
  return value;
}

function requireString(value, pathName, errors) {
  if (typeof value !== 'string') {
    errors.push(`${pathName} must be a string`);
  }
}

function requireBoolean(value, pathName, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${pathName} must be a boolean`);
  }
}

function requirePositiveInteger(value, pathName, errors) {
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${pathName} must be a positive integer`);
  }
}

function requireNonNegativeInteger(value, pathName, errors) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${pathName} must be a non-negative integer`);
  }
}

function optionalString(value, pathName, errors) {
  if (value != null && typeof value !== 'string') {
    errors.push(`${pathName} must be a string when present`);
  }
}

function optionalBoolean(value, pathName, errors) {
  if (value != null && typeof value !== 'boolean') {
    errors.push(`${pathName} must be a boolean when present`);
  }
}

function optionalObject(value, pathName, errors) {
  if (value != null && !isPlainObject(value)) {
    errors.push(`${pathName} must be an object when present`);
  }
}

function optionalStringArray(value, pathName, errors) {
  if (value == null) {
    return;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    errors.push(`${pathName} must be an array of strings when present`);
  }
}

export function createReplayCase({ report, artifact, createdAt = new Date() }) {
  if (report.status !== 'counterexample_found' || !report.counterexample) {
    throw new Error('replay cases can only be created from counterexample_found reports');
  }

  const manifest = artifact.manifest;
  const counterexample = report.counterexample;
  const compareMode = manifest.compareMode ?? 'tokens';

  return {
    caseVersion: REPLAY_CASE_VERSION,
    kind: REPLAY_CASE_KIND,
    createdAt: createdAt.toISOString(),
    problemId: report.problem.id,
    languageAgnostic: true,
    problem: {
      id: report.problem.id,
      title: report.problem.title,
      supportLevel: report.problem.supportLevel,
      artifactVersion: report.problem.artifactVersion,
    },
    source: {
      originalLanguage: report.run.language,
      seed: report.run.seed,
      runIndex: counterexample.runIndex,
      runs: report.run.runsRequested,
      runsExecuted: report.run.runsExecuted,
      shrinkApplied: Boolean(counterexample.shrunk),
    },
    limits: {
      timeoutMs: report.limits.timeoutMs,
      maxOutputBytes: report.limits.maxOutputBytes,
    },
    artifact: {
      problemId: manifest.problemId ?? report.problem.id,
      artifactVersion: manifest.artifactVersion,
      compareMode,
      oracleKind: manifest.oracleKind ?? null,
      strategies: Array.isArray(manifest.strategies) ? manifest.strategies : [],
      generator: true,
      oracle: true,
      shrinker: Boolean(artifact.shrinker),
    },
    counterexample: {
      failureKind: counterexample.failureKind,
      input: counterexample.input,
      expectedOutput: counterexample.expectedOutput,
      actualOutput: counterexample.actualOutput,
      normalizedExpected: counterexample.normalizedExpected,
      normalizedActual: counterexample.normalizedActual,
      stderr: counterexample.stderr ?? '',
      timedOut: Boolean(counterexample.timedOut),
      outputTruncated: Boolean(counterexample.outputTruncated),
      shrunk: Boolean(counterexample.shrunk),
      originalInput: counterexample.originalInput ?? null,
      caseMeta: counterexample.caseMeta ?? {},
    },
  };
}

export async function writeReplayCaseFile(filePath, replayCase) {
  const directory = path.dirname(filePath);
  const basename = path.basename(filePath);
  await fs.mkdir(directory, { recursive: true });

  let overwritten = false;
  try {
    const stat = await fs.stat(filePath);
    overwritten = stat.isFile();
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const tempPath = path.join(directory, `.${basename}.${process.pid}.${Date.now()}.tmp`);
  const contents = `${JSON.stringify(replayCase, null, 2)}\n`;

  try {
    await fs.writeFile(tempPath, contents, { flag: 'wx' });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.rm(tempPath, { force: true });
    } catch {
      // Best-effort cleanup only.
    }
    throw error;
  }

  return {
    path: filePath,
    overwritten,
  };
}

export async function readReplayCaseFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_case_file',
      error: {
        kind: 'case_file_read_error',
        message: `Could not read replay case file: ${error.message}`,
      },
    };
  }

  try {
    return {
      ok: true,
      caseFile: JSON.parse(raw),
    };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_case_file',
      error: {
        kind: 'case_json_parse_error',
        message: `Replay case file is not valid JSON: ${error.message}`,
      },
    };
  }
}

export function validateReplayCaseStructure(caseFile) {
  const errors = [];
  const root = requireObject(caseFile, 'case', errors);
  if (!root) {
    return { ok: false, errors };
  }

  if (!Object.hasOwn(root, 'caseVersion')) {
    errors.push('caseVersion is required');
  } else if (!Number.isInteger(root.caseVersion)) {
    errors.push('caseVersion must be an integer');
  }

  if (!Object.hasOwn(root, 'kind')) {
    errors.push('kind is required');
  } else {
    requireString(root.kind, 'kind', errors);
  }

  if (!Object.hasOwn(root, 'problemId')) {
    errors.push('problemId is required');
  } else {
    requirePositiveInteger(root.problemId, 'problemId', errors);
  }

  if (!Object.hasOwn(root, 'createdAt')) {
    errors.push('createdAt is required');
  } else {
    requireString(root.createdAt, 'createdAt', errors);
  }

  if (!Object.hasOwn(root, 'languageAgnostic')) {
    errors.push('languageAgnostic is required');
  } else {
    requireBoolean(root.languageAgnostic, 'languageAgnostic', errors);
  }

  const source = requireObject(root.source, 'source', errors);
  if (source) {
    optionalString(source.originalLanguage, 'source.originalLanguage', errors);
    if (!Object.hasOwn(source, 'seed')) {
      errors.push('source.seed is required');
    } else {
      requireString(source.seed, 'source.seed', errors);
    }
    if (!Object.hasOwn(source, 'runIndex')) {
      errors.push('source.runIndex is required');
    } else {
      requireNonNegativeInteger(source.runIndex, 'source.runIndex', errors);
    }
    if (!Object.hasOwn(source, 'runs')) {
      errors.push('source.runs is required');
    } else {
      requirePositiveInteger(source.runs, 'source.runs', errors);
    }
    if (!Object.hasOwn(source, 'runsExecuted')) {
      errors.push('source.runsExecuted is required');
    } else {
      requireNonNegativeInteger(source.runsExecuted, 'source.runsExecuted', errors);
    }
    if (!Object.hasOwn(source, 'shrinkApplied')) {
      errors.push('source.shrinkApplied is required');
    } else {
      requireBoolean(source.shrinkApplied, 'source.shrinkApplied', errors);
    }
  }

  const limits = requireObject(root.limits, 'limits', errors);
  if (limits) {
    if (!Object.hasOwn(limits, 'timeoutMs')) {
      errors.push('limits.timeoutMs is required');
    } else {
      requirePositiveInteger(limits.timeoutMs, 'limits.timeoutMs', errors);
    }
    if (!Object.hasOwn(limits, 'maxOutputBytes')) {
      errors.push('limits.maxOutputBytes is required');
    } else {
      requirePositiveInteger(limits.maxOutputBytes, 'limits.maxOutputBytes', errors);
    }
  }

  const artifact = requireObject(root.artifact, 'artifact', errors);
  if (artifact) {
    if (!Object.hasOwn(artifact, 'problemId')) {
      errors.push('artifact.problemId is required');
    } else {
      requirePositiveInteger(artifact.problemId, 'artifact.problemId', errors);
    }
    if (!Object.hasOwn(artifact, 'artifactVersion')) {
      errors.push('artifact.artifactVersion is required');
    } else {
      requirePositiveInteger(artifact.artifactVersion, 'artifact.artifactVersion', errors);
    }
    if (!Object.hasOwn(artifact, 'compareMode')) {
      errors.push('artifact.compareMode is required');
    } else {
      requireString(artifact.compareMode, 'artifact.compareMode', errors);
    }
    optionalString(artifact.oracleKind, 'artifact.oracleKind', errors);
    optionalStringArray(artifact.strategies, 'artifact.strategies', errors);
    optionalBoolean(artifact.generator, 'artifact.generator', errors);
    optionalBoolean(artifact.oracle, 'artifact.oracle', errors);
    optionalBoolean(artifact.shrinker, 'artifact.shrinker', errors);
  }

  const problem = root.problem;
  if (problem != null) {
    const problemObject = requireObject(problem, 'problem', errors);
    if (problemObject?.id != null) {
      requirePositiveInteger(problemObject.id, 'problem.id', errors);
    }
    optionalString(problemObject?.title, 'problem.title', errors);
    optionalString(problemObject?.supportLevel, 'problem.supportLevel', errors);
  }

  const counterexample = requireObject(root.counterexample, 'counterexample', errors);
  if (counterexample) {
    if (!Object.hasOwn(counterexample, 'failureKind')) {
      errors.push('counterexample.failureKind is required');
    } else {
      requireString(counterexample.failureKind, 'counterexample.failureKind', errors);
    }
    if (!Object.hasOwn(counterexample, 'input')) {
      errors.push('counterexample.input is required');
    } else {
      requireString(counterexample.input, 'counterexample.input', errors);
    }
    if (!Object.hasOwn(counterexample, 'expectedOutput')) {
      errors.push('counterexample.expectedOutput is required');
    } else {
      requireString(counterexample.expectedOutput, 'counterexample.expectedOutput', errors);
    }
    if (!Object.hasOwn(counterexample, 'actualOutput')) {
      errors.push('counterexample.actualOutput is required');
    } else {
      requireString(counterexample.actualOutput, 'counterexample.actualOutput', errors);
    }
    if (!Object.hasOwn(counterexample, 'stderr')) {
      errors.push('counterexample.stderr is required');
    } else {
      requireString(counterexample.stderr, 'counterexample.stderr', errors);
    }
    optionalString(counterexample.normalizedExpected, 'counterexample.normalizedExpected', errors);
    optionalString(counterexample.normalizedActual, 'counterexample.normalizedActual', errors);
    optionalBoolean(counterexample.timedOut, 'counterexample.timedOut', errors);
    optionalBoolean(counterexample.outputTruncated, 'counterexample.outputTruncated', errors);
    optionalBoolean(counterexample.shrunk, 'counterexample.shrunk', errors);
    if (counterexample.originalInput != null) {
      requireString(counterexample.originalInput, 'counterexample.originalInput', errors);
    }
    optionalObject(counterexample.caseMeta, 'counterexample.caseMeta', errors);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateReplayCaseCompatibility(caseFile, artifact) {
  if (caseFile.caseVersion !== REPLAY_CASE_VERSION) {
    return {
      ok: false,
      error: {
        kind: 'unsupported_case_version',
        message: `Unsupported replay case version: ${caseFile.caseVersion}`,
      },
    };
  }

  if (caseFile.kind !== REPLAY_CASE_KIND) {
    return {
      ok: false,
      error: {
        kind: 'wrong_case_kind',
        message: `Unsupported replay case kind: ${caseFile.kind}`,
      },
    };
  }

  if (!artifact) {
    return {
      ok: false,
      error: {
        kind: 'missing_artifact',
        message: `No counterexample artifact is available for problem ${caseFile.problemId}.`,
      },
    };
  }

  const manifest = artifact.manifest;
  if (caseFile.problem?.id != null && caseFile.problem.id !== caseFile.problemId) {
    return {
      ok: false,
      error: {
        kind: 'problem_id_mismatch',
        message: `Replay case problem.id (${caseFile.problem.id}) does not match problemId (${caseFile.problemId}).`,
      },
    };
  }

  if (caseFile.artifact.problemId !== caseFile.problemId) {
    return {
      ok: false,
      error: {
        kind: 'artifact_problem_id_mismatch',
        message: `Replay case artifact.problemId (${caseFile.artifact.problemId}) does not match problemId (${caseFile.problemId}).`,
      },
    };
  }

  if (manifest.problemId != null && manifest.problemId !== caseFile.problemId) {
    return {
      ok: false,
      error: {
        kind: 'current_artifact_problem_id_mismatch',
        message: `Current artifact problemId (${manifest.problemId}) does not match replay case problemId (${caseFile.problemId}).`,
      },
    };
  }

  if (manifest.artifactVersion !== caseFile.artifact.artifactVersion) {
    return {
      ok: false,
      error: {
        kind: 'artifact_version_mismatch',
        message: `Replay case artifact version ${caseFile.artifact.artifactVersion} does not match current version ${manifest.artifactVersion}.`,
      },
    };
  }

  const currentCompareMode = manifest.compareMode ?? 'tokens';
  if (currentCompareMode !== caseFile.artifact.compareMode) {
    return {
      ok: false,
      error: {
        kind: 'compare_mode_mismatch',
        message: `Replay case compare mode ${caseFile.artifact.compareMode} does not match current mode ${currentCompareMode}.`,
      },
    };
  }

  return { ok: true };
}
