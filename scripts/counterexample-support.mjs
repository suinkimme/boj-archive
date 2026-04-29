#!/usr/bin/env node

import { runSupportCli } from '../agent/counterexample/support.mjs';

const exitCode = await runSupportCli(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = exitCode;
