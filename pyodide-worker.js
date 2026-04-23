importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');

loadPyodide().then(py => {
  self._py = py;
  self.postMessage({ type: 'ready' });
});

self.onmessage = async ({ data: { id, code, stdin } }) => {
  const py = self._py;
  try {
    py.globals.set('_user_code', code);
    py.globals.set('_stdin_data', stdin ?? '');
    await py.runPythonAsync(`
import sys, io
sys.stdin = io.StringIO(_stdin_data)
_buf = io.StringIO()
sys.stdout = _buf
sys.stderr = _buf
exec(compile(_user_code, '<cell>', 'exec'), {})
`);
    self.postMessage({ type: 'result', id, output: py.globals.get('_buf').getvalue(), error: null });
  } catch (e) {
    self.postMessage({ type: 'result', id, output: null, error: e.message ?? String(e) });
  }
};
