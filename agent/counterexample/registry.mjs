import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultProblemsDir = path.join(moduleDir, 'problems');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function artifactPaths(problemId, problemsDir = defaultProblemsDir) {
  const artifactDir = path.join(problemsDir, String(problemId));
  return {
    artifactDir,
    manifestPath: path.join(artifactDir, 'manifest.json'),
    generatorPath: path.join(artifactDir, 'generator.mjs'),
    oraclePath: path.join(artifactDir, 'oracle.mjs'),
    shrinkerPath: path.join(artifactDir, 'shrinker.mjs'),
  };
}

export async function loadProblemArtifact(problemId, { problemsDir = defaultProblemsDir } = {}) {
  const { artifactDir, manifestPath, generatorPath, oraclePath, shrinkerPath } = artifactPaths(problemId, problemsDir);
  if (!(await exists(artifactDir))) {
    return null;
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const generator = await import(pathToFileURL(generatorPath));
  const oracle = await import(pathToFileURL(oraclePath));
  const shrinker = (await exists(shrinkerPath)) ? await import(pathToFileURL(shrinkerPath)) : null;

  if (typeof generator.generateCase !== 'function') {
    throw new Error(`artifact ${problemId} is missing generateCase()`);
  }
  if (typeof oracle.solve !== 'function') {
    throw new Error(`artifact ${problemId} is missing solve()`);
  }

  return {
    manifest,
    generator,
    oracle,
    shrinker,
  };
}

export async function listProblemArtifacts({ problemsDir = defaultProblemsDir } = {}) {
  const entries = await fs.readdir(problemsDir, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const problemId = Number(entry.name);
    if (!Number.isInteger(problemId) || problemId <= 0) {
      continue;
    }

    const paths = artifactPaths(problemId, problemsDir);
    const files = {
      manifest: await exists(paths.manifestPath),
      generator: await exists(paths.generatorPath),
      oracle: await exists(paths.oraclePath),
      shrinker: await exists(paths.shrinkerPath),
    };

    let manifest = null;
    let manifestError = null;
    if (files.manifest) {
      try {
        manifest = JSON.parse(await fs.readFile(paths.manifestPath, 'utf8'));
      } catch (error) {
        manifestError = error.message;
      }
    } else {
      manifestError = 'manifest.json is missing';
    }

    artifacts.push({
      problemId,
      artifactDir: paths.artifactDir,
      manifest,
      manifestError,
      files,
    });
  }

  return artifacts.sort((a, b) => a.problemId - b.problemId);
}
