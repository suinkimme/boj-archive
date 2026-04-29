#!/usr/bin/env node

import { runReplayCli } from '../agent/counterexample/replay.mjs';

const exitCode = await runReplayCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = exitCode;
