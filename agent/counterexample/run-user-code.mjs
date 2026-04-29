import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function commandForLanguage(language, runtimeCommands = {}) {
  if (language === 'javascript') {
    return {
      command: runtimeCommands.javascript ?? process.execPath,
      args: [],
      missingRuntime: null,
    };
  }

  if (language === 'python') {
    return {
      command: runtimeCommands.python ?? 'python3',
      args: [],
      missingRuntime: 'python3',
    };
  }

  throw new Error(`unsupported language: ${language}`);
}

function terminateChild(child, detached) {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  try {
    if (detached && process.platform !== 'win32') {
      process.kill(-child.pid, 'SIGKILL');
      return;
    }
  } catch {
    // Fall through to child.kill below.
  }

  try {
    child.kill('SIGKILL');
  } catch {
    // Best-effort cleanup only.
  }
}

export async function createTempRoot() {
  return fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'boj-ce-'));
}

export async function cleanupTempRoot(tempRoot) {
  try {
    await fs.rm(tempRoot, { recursive: true, force: true });
    return null;
  } catch (error) {
    return `Failed to clean temporary directory ${tempRoot}: ${error.message}`;
  }
}

export async function runUserCode({
  language,
  codePath,
  input,
  timeoutMs,
  maxOutputBytes,
  tempRoot,
  executionLabel,
  runtimeCommands = {},
}) {
  const { command, args, missingRuntime } = commandForLanguage(language, runtimeCommands);
  const executionCwd = await fs.mkdtemp(path.join(tempRoot, `${executionLabel}-`));
  const detached = process.platform !== 'win32';

  return new Promise((resolve) => {
    const child = spawn(command, [...args, codePath], {
      cwd: executionCwd,
      shell: false,
      detached,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH ?? '',
        NO_COLOR: '1',
        CI: process.env.CI ?? '1',
        PYTHONIOENCODING: 'UTF-8',
      },
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let combinedBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;

    const finish = async (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);

      let cleanupWarning = null;
      try {
        await fs.rm(executionCwd, { recursive: true, force: true });
      } catch (error) {
        cleanupWarning = `Failed to clean execution directory ${executionCwd}: ${error.message}`;
      }

      resolve({
        stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString('utf8'),
        stderr: Buffer.concat(stderrChunks, stderrBytes).toString('utf8'),
        timedOut,
        outputLimitExceeded,
        outputTruncated: outputLimitExceeded,
        cleanupWarning,
        ...result,
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      terminateChild(child, detached);
    }, timeoutMs);

    const appendChunk = (chunks, chunk, currentBytes) => {
      if (outputLimitExceeded) {
        return currentBytes;
      }

      const remaining = maxOutputBytes - combinedBytes;
      if (chunk.length > remaining) {
        if (remaining > 0) {
          chunks.push(chunk.subarray(0, remaining));
          combinedBytes += remaining;
          currentBytes += remaining;
        }
        outputLimitExceeded = true;
        terminateChild(child, detached);
        return currentBytes;
      }

      chunks.push(chunk);
      combinedBytes += chunk.length;
      currentBytes += chunk.length;
      return currentBytes;
    };

    child.stdout.on('data', (chunk) => {
      stdoutBytes = appendChunk(stdoutChunks, chunk, stdoutBytes, 'stdout');
    });

    child.stderr.on('data', (chunk) => {
      stderrBytes = appendChunk(stderrChunks, chunk, stderrBytes, 'stderr');
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT' && missingRuntime) {
        finish({
          errorKind: 'missing_runtime',
          runtime: missingRuntime,
          message: `Missing runtime: ${missingRuntime}`,
          exitCode: null,
          signal: null,
        });
        return;
      }

      finish({
        errorKind: 'runner_error',
        message: error.message,
        exitCode: null,
        signal: null,
      });
    });

    child.on('close', (exitCode, signal) => {
      finish({
        exitCode,
        signal,
      });
    });

    child.stdin.on('error', () => {
      // Broken pipe is reported through process exit or spawn error.
    });
    child.stdin.end(input);
  });
}
