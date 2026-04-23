import JSCPP from 'https://esm.sh/JSCPP';

// JSCPP는 bits/stdc++.h를 기본 지원하지 않음 — 지원 헤더 전체를 로드하는 alias 추가
JSCPP.includes['bits/stdc++.h'] = {
  load(rt) {
    for (const h of ['iostream', 'cctype', 'cstring', 'cmath', 'cstdio', 'cstdlib', 'ctime', 'iomanip']) {
      rt.include(h);
    }
  }
};

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
