importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.js");

let pyodide = null;

async function initPyodide() {
  try {
    pyodide = await loadPyodide();
    self.postMessage({ type: "ready" });
  } catch (err) {
    self.postMessage({
      type: "result",
      id: null,
      output: null,
      error: "Pyodide 로드 실패: " + err.message,
    });
  }
}

self.onmessage = async ({ data: { id, code, stdin } }) => {
  if (!pyodide) {
    self.postMessage({
      type: "result",
      id,
      output: null,
      error: "Pyodide가 아직 준비되지 않았습니다.",
    });
    return;
  }

  let namespace = null;
  try {
    // download any third-party packages the code imports (numpy, pandas, etc.)
    await pyodide.loadPackagesFromImports(code);

    // fresh namespace per run — prevents globals leaking across submissions
    namespace = pyodide.globals.get("dict")();
    namespace.set("_stdin_data", stdin ?? "");
    namespace.set("_user_code", code);

    await pyodide.runPythonAsync(
      `
import sys, io
sys.stdin  = io.StringIO(_stdin_data)
_stdout_buf = io.StringIO()
_stderr_buf = io.StringIO()
sys.stdout = _stdout_buf
sys.stderr = _stderr_buf
exec(compile(_user_code, '<stdin>', 'exec'), {})
`,
      { globals: namespace },
    );

    const output = namespace.get("_stdout_buf").getvalue();
    const stderr = namespace.get("_stderr_buf").getvalue();
    self.postMessage({ type: "result", id, output, error: stderr || null });
  } catch (err) {
    // prefer the Python traceback from stderr; fall back to the JS error message
    let stderr = null;
    try {
      stderr = namespace?.get("_stderr_buf")?.getvalue();
    } catch {}
    self.postMessage({
      type: "result",
      id,
      output: null,
      error: stderr || err.message || String(err),
    });
  } finally {
    // Python proxy objects live in WASM memory and must be destroyed explicitly
    if (namespace?.destroy) namespace.destroy();
  }
};

initPyodide();
