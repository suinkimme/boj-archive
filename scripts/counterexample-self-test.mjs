#!/usr/bin/env node

import { runSelfTestCli } from '../agent/counterexample/self-test.mjs';

const exitCode = await runSelfTestCli(process.argv.slice(2), {
  rootDir: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exitCode = exitCode;
