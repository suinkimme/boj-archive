import JSCPP from 'https://esm.sh/JSCPP';

self.postMessage({ type: 'ready' });

self.onmessage = ({ data: { id, code, stdin } }) => {
  let output = '';
  try {
    // JSCPP 전처리기가 bits/stdc++.h의 "++"를 파싱 못함 — 지원 헤더로 직접 치환
    const src = code.replace(
      /#\s*include\s*<bits\/stdc\+\+\.h>/g,
      '#include <iostream>\n#include <cstdio>\n#include <cmath>\n#include <cstring>\n#include <cstdlib>\n#include <cctype>'
    );
    const cfg = { stdio: { write: s => { output += s; } } };
    JSCPP.run(src, stdin ?? '', cfg);
    self.postMessage({ type: 'result', id, output, error: null });
  } catch (e) {
    self.postMessage({ type: 'result', id, output: null, error: e.message ?? String(e) });
  }
};
