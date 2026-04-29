import { listProblemArtifacts } from './registry.mjs';
import { SUPPORT_EXIT_CODES } from './exit-codes.mjs';

function usage() {
  return `Usage:
  node scripts/counterexample-support.mjs [options]

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

function makeEntry(metadata) {
  const manifest = metadata.manifest ?? {};
  return {
    problemId: metadata.problemId,
    title: manifest.title ?? null,
    supportLevel: manifest.supportLevel ?? null,
    strategy: Array.isArray(manifest.strategies) ? manifest.strategies : [],
    compareMode: manifest.compareMode ?? null,
    oracleKind: manifest.oracleKind ?? null,
    artifactVersion: manifest.artifactVersion ?? null,
    generator: metadata.files.generator,
    oracle: metadata.files.oracle,
    shrinker: metadata.files.shrinker,
    manifestValid: !metadata.manifestError,
    manifestError: metadata.manifestError,
  };
}

function makeReport(entries) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    problems: entries.map(makeEntry),
  };
}

function formatHumanReport(report) {
  const lines = ['Counterexample Support Matrix', ''];

  for (const problem of report.problems) {
    const capabilities = [
      `generator:${problem.generator ? 'yes' : 'no'}`,
      `oracle:${problem.oracle ? 'yes' : 'no'}`,
      `shrinker:${problem.shrinker ? 'yes' : 'no'}`,
    ].join(' ');

    lines.push(
      `${problem.problemId} ${problem.title ?? '(unknown title)'}`,
      `  support: ${problem.supportLevel ?? 'unknown'}`,
      `  artifact: v${problem.artifactVersion ?? 'unknown'}, compare: ${problem.compareMode ?? 'unknown'}, oracle: ${problem.oracleKind ?? 'unknown'}`,
      `  capabilities: ${capabilities}`,
      `  strategies: ${problem.strategy.length ? problem.strategy.join('; ') : '(none)'}`,
    );

    if (problem.manifestError) {
      lines.push(`  manifest error: ${problem.manifestError}`);
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export async function runSupportCli(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr.write(`${error.message}\n\n${usage()}`);
    return SUPPORT_EXIT_CODES.invalid_args;
  }

  if (options.help) {
    stdout.write(usage());
    return SUPPORT_EXIT_CODES.success;
  }

  try {
    const report = makeReport(await listProblemArtifacts());
    if (options.json) {
      stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      stdout.write(formatHumanReport(report));
    }
    return SUPPORT_EXIT_CODES.success;
  } catch (error) {
    const report = {
      schemaVersion: 1,
      status: 'harness_error',
      error: {
        kind: 'support_matrix_error',
        message: error.message,
      },
    };
    if (options.json) {
      stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      stderr.write(`Support matrix error: ${error.message}\n`);
    }
    return SUPPORT_EXIT_CODES.harness_error;
  }
}
