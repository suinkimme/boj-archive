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
    // 코드에서 import한 서드파티 패키지를 자동으로 다운로드 (numpy, pandas 등)
    await pyodide.loadPackagesFromImports(code);

    // 실행마다 새 namespace 생성 — 이전 제출의 전역 변수가 남지 않도록 격리
    namespace = pyodide.globals.get("dict")();
    namespace.set("_stdin_data", stdin ?? "");
    namespace.set("_user_code", code);

    // Python 레벨에서 예외를 잡아 traceback을 _stderr_buf에 기록
    await pyodide.runPythonAsync(
      `
import sys, io, traceback
sys.stdin   = io.StringIO(_stdin_data)
_stdout_buf = io.StringIO()
_stderr_buf = io.StringIO()
sys.stdout  = _stdout_buf
sys.stderr  = _stderr_buf
try:
    exec(compile(_user_code, '<stdin>', 'exec'), {"__builtins__": __builtins__})
except Exception:
    traceback.print_exc(file=_stderr_buf)
`,
      { globals: namespace },
    );

    const output = namespace.get("_stdout_buf").getvalue();
    const stderr = namespace.get("_stderr_buf").getvalue();
    self.postMessage({
      type: "result",
      id,
      output: output || null,
      error: stderr || null,
    });
  } catch (err) {
    // JS/Worker 레벨 오류만 여기 도달 (예: loadPackagesFromImports 실패)
    let stderr = null;
    try {
      stderr = namespace?.get("_stderr_buf")?.getvalue();
    } catch (e) {
      console.warn("stderr 버퍼 읽기 실패:", e);
    }
    self.postMessage({
      type: "result",
      id,
      output: null,
      error: stderr || err.message || String(err),
    });
  } finally {
    // Python 프록시는 WASM 메모리에 남으므로 명시적으로 해제해야 함
    if (namespace?.destroy) namespace.destroy();
  }
};

initPyodide();
