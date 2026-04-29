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

export async function loadProblemArtifact(problemId, { problemsDir = defaultProblemsDir } = {}) {
  const artifactDir = path.join(problemsDir, String(problemId));
  if (!(await exists(artifactDir))) {
    return null;
  }

  const manifestPath = path.join(artifactDir, 'manifest.json');
  const generatorPath = path.join(artifactDir, 'generator.mjs');
  const oraclePath = path.join(artifactDir, 'oracle.mjs');
  const shrinkerPath = path.join(artifactDir, 'shrinker.mjs');

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
