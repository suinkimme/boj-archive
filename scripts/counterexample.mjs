#!/usr/bin/env node

import { runCli } from '../agent/counterexample/cli.mjs';

const exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = exitCode;
