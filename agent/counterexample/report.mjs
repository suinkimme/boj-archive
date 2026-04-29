export const EXIT_CODES = {
  not_found: 0,
  counterexample_found: 1,
  unsupported: 2,
  harness_error: 3,
  invalid_args: 64,
};

export function exitCodeForReport(report) {
  return EXIT_CODES[report?.status] ?? EXIT_CODES.harness_error;
}

export function makeBaseReport({
  status,
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
  message,
  counterexample = null,
  error = null,
  warnings = [],
}) {
  return {
    schemaVersion: 1,
    status,
    problem: {
      id: Number(problemId),
      title: problemTitle,
      supportLevel,
      artifactVersion,
    },
    run: {
      language,
      codePath,
      runsRequested,
      runsExecuted,
      seed: String(seed),
    },
    limits: {
      timeoutMs,
      maxOutputBytes,
    },
    result: {
      guarantee: 'not_found_does_not_prove_correctness',
      message,
    },
    counterexample,
    error,
    warnings,
  };
}

function indentBlock(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  if (normalized.length === 0) {
    return '(empty)';
  }
  return normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
}

export function formatHumanReport(report) {
  const lines = [
    'Counterexample Finder',
    `Problem: ${report.problem.id}${report.problem.title ? ` ${report.problem.title}` : ''} (support: ${report.problem.supportLevel ?? 'unknown'})`,
    `Language: ${report.run.language}`,
    `Runs: ${report.run.runsRequested} requested, ${report.run.runsExecuted} executed`,
    `Seed: ${report.run.seed}`,
    '',
  ];

  if (report.status === 'counterexample_found') {
    const counterexample = report.counterexample;
    lines.push(
      `Found counterexample at run #${counterexample.runIndex}.`,
      `Failure: ${counterexample.failureKind}`,
      '',
      'Input:',
      indentBlock(counterexample.input),
      '',
      'Expected:',
      indentBlock(counterexample.expectedOutput),
      '',
      'Actual:',
      indentBlock(counterexample.actualOutput),
    );

    if (counterexample.stderr) {
      lines.push('', 'Stderr:', indentBlock(counterexample.stderr));
    }

    if (counterexample.shrunk) {
      lines.push('', 'Shrunk: yes');
    }
  } else if (report.status === 'not_found') {
    lines.push('No counterexample found in this strategy. This does not guarantee correctness.');
  } else if (report.status === 'unsupported') {
    lines.push(`Unsupported problem: ${report.error?.message ?? 'no counterexample artifact is available.'}`);
  } else {
    lines.push(`Harness error: ${report.error?.kind ?? 'unknown'}`);
    if (report.error?.message) {
      lines.push(report.error.message);
    }
  }

  if (report.warnings?.length) {
    lines.push('', 'Warnings:');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function writeReport(report, { json, stdout }) {
  if (json) {
    stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  stdout.write(formatHumanReport(report));
}
