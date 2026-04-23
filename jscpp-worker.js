import JSCPP from 'https://esm.sh/JSCPP';

self.postMessage({ type: 'ready' });

self.onmessage = ({ data: { id, code, stdin } }) => {
  let output = '';
  try {
    const cfg = { stdio: { write: s => { output += s; } } };
    JSCPP.run(code, stdin ?? '', cfg);
    self.postMessage({ type: 'result', id, output, error: null });
  } catch (e) {
    self.postMessage({ type: 'result', id, output: null, error: e.message ?? String(e) });
  }
};
