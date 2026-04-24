const PER_PAGE = 50;
// prettier-ignore
let all = [], filtered = [], page = 1;

// prettier-ignore
let tierFilter = "all", tagFilter = "", query = "";

// prettier-ignore
const TIER_COLORS = [
  "#64748b",
  "#ad5600","#ad5600","#ad5600","#ad5600","#ad5600",
  "#435f7a","#435f7a","#435f7a","#435f7a","#435f7a",
  "#d97706","#d97706","#d97706","#d97706","#d97706",
  "#059669","#059669","#059669","#059669","#059669",
  "#0284c7","#0284c7","#0284c7","#0284c7","#0284c7",
  "#e11d48","#e11d48","#e11d48","#e11d48","#e11d48",
];

// prettier-ignore
const TIER_NAMES = [
  "Unrated",
  "Bronze V","Bronze IV","Bronze III","Bronze II","Bronze I",
  "Silver V","Silver IV","Silver III","Silver II","Silver I",
  "Gold V",  "Gold IV",  "Gold III",  "Gold II",  "Gold I",
  "Platinum V","Platinum IV","Platinum III","Platinum II","Platinum I",
  "Diamond V","Diamond IV","Diamond III","Diamond II","Diamond I",
  "Ruby V",  "Ruby IV",  "Ruby III",  "Ruby II",  "Ruby I",
];

function tierBadge(level) {
  const name = TIER_NAMES[level] ?? "Unrated";
  const color = TIER_COLORS[level] ?? "#64748b";
  return `<span class="tier-badge" style="color:${color};background:${color}18;border:1px solid ${color}44">${name}</span>`;
}

function fmtCount(n) {
  if (!n) return "-";
  return n >= 10000 ? (n / 1000).toFixed(0) + "k" : n.toLocaleString();
}

function matchesTier(level, f) {
  if (f === "all") return true;
  if (f === "0") return level === 0 || level == null;
  const [a, b] = f.split("-").map(Number);
  return level >= a && level <= b;
}

function applyFilter() {
  filtered = all.filter((p) => {
    if (!matchesTier(p.level, tierFilter)) return false;
    if (tagFilter && !p.tags?.includes(tagFilter)) return false;
    if (query) {
      const q = query.toLowerCase();
      return String(p.id).includes(q) || p.title?.toLowerCase().includes(q);
    }
    return true;
  });
  page = 1;
  render();
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  history.replaceState(
    null,
    "",
    params.toString() ? `?${params}` : location.pathname,
  );
}

function render() {
  const total = filtered.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const items = filtered.slice(start, start + PER_PAGE);

  document.getElementById("stat").textContent =
    `${total.toLocaleString()} 문제`;

  if (items.length === 0) {
    document.getElementById("content").innerHTML =
      '<div class="empty">검색 결과가 없습니다.</div>';
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const rows = items
    .map(
      (p) => `
    <tr class="problem-row" data-id="${p.id}">
      <td class="problem-num">#${p.id}</td>
      <td class="problem-title">${escHtml(p.title ?? "")}</td>
      <td>${tierBadge(p.level ?? 0)}</td>
      <td class="tag-list">${(p.tags ?? [])
        .slice(0, 3)
        .map((t) => `<span class="tag">${t}</span>`)
        .join("")}</td>
      <td class="accept-count">${fmtCount(p.accepted_user_count)}</td>
    </tr>`,
    )
    .join("");

  document.getElementById("content").innerHTML = `
    <table class="problem-table">
      <thead><tr>
        <th style="width:80px">번호</th>
        <th>제목</th>
        <th style="width:120px">난이도</th>
        <th style="width:200px">태그</th>
        <th style="width:90px">정답자</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Pagination
  const pages = [];
  pages.push(
    `<button class="page-btn" ${page === 1 ? "disabled" : ""} id="prev-btn">‹</button>`,
  );
  let lo = Math.max(1, page - 2),
    hi = Math.min(totalPages, page + 2);
  if (lo > 1) {
    pages.push(`<button class="page-btn" data-p="1">1</button>`);
    if (lo > 2) pages.push(`<span class="page-info">…</span>`);
  }
  for (let i = lo; i <= hi; i++)
    pages.push(
      `<button class="page-btn${i === page ? " active" : ""}" data-p="${i}">${i}</button>`,
    );
  if (hi < totalPages) {
    if (hi < totalPages - 1) pages.push(`<span class="page-info">…</span>`);
    pages.push(
      `<button class="page-btn" data-p="${totalPages}">${totalPages}</button>`,
    );
  }
  pages.push(
    `<button class="page-btn" ${page === totalPages ? "disabled" : ""} id="next-btn">›</button>`,
  );
  pages.push(
    `<span class="page-info">${start + 1}–${Math.min(start + PER_PAGE, total)} / ${total.toLocaleString()}</span>`,
  );
  document.getElementById("pagination").innerHTML = pages.join("");

  // Row click
  document.querySelectorAll(".problem-row").forEach((r) => {
    r.addEventListener("click", () => openProblem(+r.dataset.id));
  });
  document.getElementById("prev-btn")?.addEventListener("click", () => {
    page--;
    render();
    scrollTo(0, 0);
  });
  document.getElementById("next-btn")?.addEventListener("click", () => {
    page++;
    render();
    scrollTo(0, 0);
  });
  document.querySelectorAll("[data-p]").forEach((b) => {
    b.addEventListener("click", () => {
      page = +b.dataset.p;
      render();
      scrollTo(0, 0);
    });
  });
}

async function openProblem(id, pushState = true) {
  document.getElementById("modal-content").innerHTML =
    '<div class="loading"><div class="spinner"></div>로딩 중...</div>';
  document.getElementById("modal-overlay").classList.add("open");

  if (pushState) {
    const params = new URLSearchParams(location.search);
    params.set("p", id);
    history.pushState({ problemId: id }, "", `?${params}`);
  }

  try {
    const res = await fetch(`problems/${id}/problem.json`);
    if (!res.ok) throw new Error("not found");
    const p = await res.json();
    renderModal(p);
    // 제목 및 메타 업데이트
    const tierName = TIER_NAMES[p.level ?? 0] ?? "Unrated";
    document.title = `${p.id}번 ${p.title} — BOJ Archive`;
    setMeta("og:title", `${p.id}번 ${p.title} [${tierName}] — BOJ Archive`);
    setMeta(
      "og:description",
      `${p.time_limit ?? ""} | ${p.memory_limit ?? ""} | 태그: ${(p.tags ?? []).join(", ")}`,
    );
    setMeta(
      "twitter:title",
      `${p.id}번 ${p.title} [${tierName}] — BOJ Archive`,
    );
  } catch {
    document.getElementById("modal-content").innerHTML =
      '<div class="empty">문제 데이터를 불러올 수 없습니다.</div>';
  }
}

function setMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (el) el.setAttribute("content", content);
}

function renderModal(p) {
  currentSamples = p.samples ?? [];
  const samples = (p.samples ?? [])
    .map(
      (s, i) => `
    <div class="sample-grid" style="margin-bottom:12px">
      <div class="sample-box">
        <div class="sample-box-header">예제 입력 ${i + 1}</div>
        <pre>${escHtml(s.input ?? "")}</pre>
      </div>
      <div class="sample-box">
        <div class="sample-box-header">예제 출력 ${i + 1}</div>
        <pre>${escHtml(s.output ?? "")}</pre>
      </div>
    </div>`,
    )
    .join("");

  const tags = (p.tags ?? [])
    .map((t) => `<span class="modal-tag" data-tag="${t}">${t}</span>`)
    .join("");

  document.getElementById("modal-content").innerHTML = `
    <div class="modal-header">
      <div class="modal-num">문제 #${p.id}</div>
      <div class="modal-title">${escHtml(p.title ?? "")}</div>
      <div class="modal-meta">
        ${tierBadge(p.level ?? 0)}
        ${p.time_limit ? `<span class="meta-item">시간 <span>${p.time_limit}</span></span>` : ""}
        ${p.memory_limit ? `<span class="meta-item">메모리 <span>${p.memory_limit}</span></span>` : ""}
        ${p.accepted_user_count ? `<span class="meta-item">정답자 <span>${p.accepted_user_count.toLocaleString()}</span></span>` : ""}
        ${p.average_tries ? `<span class="meta-item">평균 시도 <span>${p.average_tries.toFixed(1)}</span></span>` : ""}
      </div>
      ${tags ? `<div class="modal-tags">${tags}</div>` : ""}
    </div>
    <hr class="modal-divider">
    ${section("문제", p.description, p.id)}
    ${section("입력", p.input, p.id)}
    ${section("출력", p.output, p.id)}
    ${samples ? `<div class="modal-section"><div class="modal-section-title">예제</div>${samples}</div>` : ""}
    ${p.hint ? section("힌트", p.hint, p.id) : ""}
    ${p.source ? `<div class="modal-section"><div class="modal-section-title">출처</div><div style="color:var(--text-muted);font-size:14px">${escHtml(p.source)}</div></div>` : ""}
    <hr class="modal-divider">
    <div class="modal-section py-runner" id="py-runner">
      <div class="modal-section-title">코드 실행기</div>
      <div class="runner-lang-row">
        <select class="runner-lang-select" id="runner-lang">
          <option value="python">Python 3</option>
          <option value="cpp">C / C++</option>
        </select>
        <span class="runner-lang-hint" id="runner-lang-hint"></span>
      </div>
      <textarea class="py-textarea" id="py-code" rows="12" spellcheck="false"></textarea>
      <div class="py-top-actions">
        <button class="py-run-all-btn" id="py-run-all-btn">▶▶ 전체 실행</button>
        <span class="py-status" id="py-status"></span>
      </div>
      <div class="py-chips-row" id="py-chips-row">
        <button class="py-chip py-chip-add" id="py-add-btn">+ 추가</button>
      </div>
      <div class="py-details" id="py-details"></div>
    </div>
  `;

  // Tag click → filter
  document.querySelectorAll(".modal-tag").forEach((el) => {
    el.addEventListener("click", () => {
      document.getElementById("tag-select").value = el.dataset.tag;
      tagFilter = el.dataset.tag;
      closeModal();
      applyFilter();
    });
  });

  attachRunnerListeners(currentSamples, p.id);
}

function fixImgPaths(html, id) {
  return html.replace(
    /(<img\s[^>]*src=["'])(?!https?:\/\/|\/\/|\/|problems\/)(.*?)(["'])/gi,
    (_, pre, src, suf) => `${pre}problems/${id}/${src}${suf}`,
  );
}

function section(title, html, id) {
  if (!html) return "";
  return `<div class="modal-section"><div class="modal-section-title">${title}</div><div class="problem-content">${fixImgPaths(html, id)}</div></div>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  // URL에서 p 파라미터 제거, 제목 복원
  const params = new URLSearchParams(location.search);
  params.delete("p");
  const newUrl = params.toString() ? `?${params}` : location.pathname;
  history.pushState(null, "", newUrl);
  document.title = "BOJ Archive — 백준 온라인 저지 문제 아카이브";
  setMeta("og:title", "BOJ Archive — 백준 온라인 저지 문제 아카이브");
}

// ── Multi-Language Runner ─────────────────────────────────────────
let currentSamples = [];
const RUN_TIMEOUT_MS = 10000;

const langWorkers = {};
const langReady = {};
const langQueues = {};
const langPending = {};
const langSeq = {};
const langTimeout = {};
const langCodeStore = {};

const LANG_PLACEHOLDERS = {
  python:
    "# Python 코드를 여기에 입력하세요\nimport sys\ninput = sys.stdin.readline",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    \n    return 0;\n}",
};
const LANG_HINTS = {
  python: "Pyodide WASM",
  cpp: "JSCPP 인터프리터 (일부 제한)",
};
const LANG_WORKER_FILES = {
  python: "js/pyodide-worker.js",
  cpp: "js/jscpp-worker.js",
};
const LANG_LOADING_MSG = {
  python: "Pyodide 로딩 중... (최초 실행 시 수십 초 소요)",
  cpp: "JSCPP 로딩 중...",
};

function createLangWorker(lang) {
  const opts = lang === "cpp" ? { type: "module" } : undefined;
  const w = new Worker(LANG_WORKER_FILES[lang], opts);
  langWorkers[lang] = w;
  langReady[lang] = false;
  langPending[lang] = langPending[lang] ?? new Map();
  langSeq[lang] = langSeq[lang] ?? 0;
  langQueues[lang] = langQueues[lang] ?? [];
  w.onmessage = ({ data }) => {
    if (data.type === "ready") {
      langReady[lang] = true;
      (langQueues[lang] ?? []).splice(0).forEach((cb) => cb());
      return;
    }
    if (data.type === "result") {
      const resolve = langPending[lang].get(data.id);
      if (resolve) {
        langPending[lang].delete(data.id);
        resolve({ output: data.output, error: data.error });
      }
    }
  };
  w.onerror = (e) => {
    const msg = "Worker 오류: " + (e.message ?? "");
    langPending[lang].forEach((resolve) =>
      resolve({ output: null, error: msg }),
    );
    langPending[lang].clear();
    resetLangWorker(lang);
  };
}

function resetLangWorker(lang) {
  if (langWorkers[lang]) {
    langWorkers[lang].terminate();
    langWorkers[lang] = null;
  }
  langReady[lang] = false;
  langQueues[lang] = [];
  clearTimeout(langTimeout[lang]);
  langTimeout[lang] = null;
  if (langPending[lang]) {
    langPending[lang].forEach((resolve) =>
      resolve({ output: null, error: "시간 초과 (10초)" }),
    );
    langPending[lang].clear();
  }
}

function ensureLangWorker(lang, onReady) {
  if (langReady[lang]) {
    onReady();
    return;
  }
  if (!langQueues[lang]) langQueues[lang] = [];
  langQueues[lang].push(onReady);
  if (!langWorkers[lang]) createLangWorker(lang);
}

function runCode(lang, code, stdinData) {
  return new Promise((resolve) => {
    const statusEl = document.getElementById("py-status");
    if (!langReady[lang] && statusEl)
      statusEl.textContent = LANG_LOADING_MSG[lang] ?? "";
    ensureLangWorker(lang, () => {
      if (statusEl) statusEl.textContent = "";
      if (!langPending[lang]) langPending[lang] = new Map();
      if (!(lang in langSeq)) langSeq[lang] = 0;
      const id = ++langSeq[lang];
      langPending[lang].set(id, resolve);
      clearTimeout(langTimeout[lang]);
      langTimeout[lang] = setTimeout(() => {
        if (langPending[lang].has(id)) {
          langPending[lang].delete(id);
          resolve({ output: null, error: "시간 초과 (10초)" });
          resetLangWorker(lang);
        }
      }, RUN_TIMEOUT_MS);
      langWorkers[lang].postMessage({ id, code, stdin: stdinData });
    });
  });
}

let caseIdx = 0;

function createChip(idx, label) {
  const chip = document.createElement("button");
  chip.className = "py-chip py-chip-case";
  chip.dataset.idx = idx;
  chip.innerHTML = `<span>${escHtml(label)}</span><span class="py-chip-icon"></span>`;
  chip.addEventListener("click", () => {
    const detail = document.querySelector(`.py-detail[data-idx="${idx}"]`);
    if (!detail) return;
    const isOpen = detail.classList.contains("open");
    document
      .querySelectorAll(".py-detail.open")
      .forEach((d) => d.classList.remove("open"));
    document
      .querySelectorAll(".py-chip-case.active")
      .forEach((c) => c.classList.remove("active"));
    if (!isOpen) {
      detail.classList.add("open");
      chip.classList.add("active");
    }
  });
  return chip;
}

function createDetail(idx, label, inputVal, expectedVal, isCustom) {
  const el = document.createElement("div");
  el.className = "py-detail";
  el.dataset.idx = idx;
  const inputContent = isCustom
    ? `<textarea class="py-detail-ta py-detail-input" rows="3" spellcheck="false"></textarea>`
    : `<pre class="py-detail-pre py-detail-input">${escHtml(inputVal)}</pre>`;
  const expectedContent = isCustom
    ? `<textarea class="py-detail-ta py-detail-expected" rows="3" placeholder="생략 시 비교 안 함" spellcheck="false"></textarea>`
    : `<pre class="py-detail-pre py-detail-expected">${escHtml(expectedVal)}</pre>`;
  el.innerHTML = `
    <div class="py-detail-header">
      <span>${escHtml(label)}</span>
      ${isCustom ? '<button class="py-detail-del">✕ 삭제</button>' : ""}
    </div>
    <div class="py-detail-grid">
      <div class="py-detail-col">
        <div class="py-detail-col-label">입력</div>
        ${inputContent}
      </div>
      <div class="py-detail-col">
        <div class="py-detail-col-label">기대 출력${isCustom ? ' <span style="opacity:.5;font-weight:400">(선택)</span>' : ""}</div>
        ${expectedContent}
      </div>
      <div class="py-detail-col">
        <div class="py-detail-col-label">실제 출력</div>
        <pre class="py-detail-pre py-detail-actual muted">—</pre>
      </div>
    </div>`;
  el.querySelector(".py-detail-del")?.addEventListener("click", () => {
    document.querySelector(`.py-chip-case[data-idx="${idx}"]`)?.remove();
    el.remove();
  });
  return el;
}

function addCase(label, inputVal, expectedVal, isCustom, autoOpen = false) {
  const idx = caseIdx++;
  const chip = createChip(idx, label);
  const detail = createDetail(idx, label, inputVal, expectedVal, isCustom);
  document
    .getElementById("py-chips-row")
    .insertBefore(chip, document.getElementById("py-add-btn"));
  document.getElementById("py-details").appendChild(detail);
  if (autoOpen) {
    detail.classList.add("open");
    chip.classList.add("active");
  }
}

async function runTestCase(idx, code, lang) {
  const chip = document.querySelector(`.py-chip-case[data-idx="${idx}"]`);
  const detail = document.querySelector(`.py-detail[data-idx="${idx}"]`);
  if (!chip || !detail) return;

  const inputEl = detail.querySelector(".py-detail-input");
  const expectedEl = detail.querySelector(".py-detail-expected");
  const actualEl = detail.querySelector(".py-detail-actual");
  const stdin =
    inputEl.tagName === "TEXTAREA" ? inputEl.value : inputEl.textContent;
  const expected = expectedEl
    ? expectedEl.tagName === "TEXTAREA"
      ? expectedEl.value
      : expectedEl.textContent
    : "";

  chip.className = "py-chip py-chip-case running";
  chip.querySelector(".py-chip-icon").textContent = "";

  const { output, error } = await runCode(lang, code, stdin);

  chip.classList.remove("running");

  if (error) {
    if (output) {
      actualEl.innerHTML = `<span>${escHtml(output)}</span><span class="py-stderr">${escHtml(error)}</span>`;
      actualEl.className = "py-detail-pre py-detail-actual";
    } else {
      actualEl.textContent = error;
      actualEl.className = "py-detail-pre py-detail-actual py-stderr";
    }
    chip.className = "py-chip py-chip-case error";
    chip.querySelector(".py-chip-icon").textContent = "!";
    chip.dataset.verdict = "error";
    // 오류는 자동으로 펼침
    detail.classList.add("open");
    chip.classList.add("active");
  } else {
    actualEl.textContent = output;
    actualEl.className = "py-detail-pre py-detail-actual";
    if (expected.trim() !== "") {
      const pass = (output ?? "").trim() === expected.trim();
      chip.className = "py-chip py-chip-case " + (pass ? "pass" : "fail");
      chip.querySelector(".py-chip-icon").textContent = pass ? "✓" : "✗";
      chip.dataset.verdict = pass ? "pass" : "fail";
      if (!pass) {
        detail.classList.add("open");
        chip.classList.add("active");
      }
    } else {
      chip.className = "py-chip py-chip-case";
      chip.querySelector(".py-chip-icon").textContent = "✓";
      chip.dataset.verdict = "run";
    }
  }
}

function attachRunnerListeners(samples, problemId) {
  const codeEl = document.getElementById("py-code");
  const langSel = document.getElementById("runner-lang");
  const hintEl = document.getElementById("runner-lang-hint");
  const addBtn = document.getElementById("py-add-btn");
  const runAllBtn = document.getElementById("py-run-all-btn");
  if (!codeEl) return;

  const getLang = () => langSel?.value ?? "python";

  function restoreCode(lang) {
    const key = lang + ":" + problemId;
    codeEl.value = langCodeStore[key] ?? "";
    codeEl.placeholder = LANG_PLACEHOLDERS[lang] ?? "";
    if (hintEl) hintEl.textContent = LANG_HINTS[lang] ?? "";
  }

  function saveCode(lang) {
    langCodeStore[lang + ":" + problemId] = codeEl.value;
  }

  const savedLang = sessionStorage.getItem("runner-lang") ?? "python";
  if (langSel) langSel.value = savedLang;
  restoreCode(savedLang);

  langSel?.addEventListener("change", () => {
    const prev = sessionStorage.getItem("runner-lang") ?? "python";
    saveCode(prev);
    const lang = getLang();
    sessionStorage.setItem("runner-lang", lang);
    restoreCode(lang);
  });

  caseIdx = 0;
  samples.forEach((s, i) =>
    addCase(`예제 ${i + 1}`, s.input ?? "", s.output ?? "", false),
  );

  codeEl.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = codeEl.selectionStart,
        end = codeEl.selectionEnd;
      codeEl.value =
        codeEl.value.slice(0, s) + "    " + codeEl.value.slice(end);
      codeEl.selectionStart = codeEl.selectionEnd = s + 4;
    }
  });

  let customCount = 0;
  addBtn.addEventListener("click", () => {
    customCount++;
    addCase(`사용자 ${customCount}`, "", "", true, true);
  });

  runAllBtn.addEventListener("click", async () => {
    const lang = getLang();
    const code = codeEl.value;
    saveCode(lang);
    const chips = [...document.querySelectorAll(".py-chip-case")];
    const statusEl = document.getElementById("py-status");
    if (statusEl) statusEl.textContent = "";
    runAllBtn.disabled = true;
    try {
      for (const chip of chips) {
        await runTestCase(+chip.dataset.idx, code, lang);
      }
    } catch (err) {
      console.error("실행 중 오류 발생:", err);
    } finally {
      runAllBtn.disabled = false;
    }
    let passed = 0,
      total = 0;
    document.querySelectorAll(".py-chip-case").forEach((c) => {
      const v = c.dataset.verdict;
      if (v === "pass" || v === "fail" || v === "error") total++;
      if (v === "pass") passed++;
    });
    if (statusEl && total > 0)
      statusEl.textContent = `${passed} / ${total} 통과`;
  });
}

// Service Worker (Pyodide 캐싱)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// Init
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// 뒤로가기/앞으로가기 지원
window.addEventListener("popstate", (e) => {
  const id = new URLSearchParams(location.search).get("p");
  if (id) openProblem(+id, false);
  else closeModal();
});

let searchTimer;
document.getElementById("search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query = e.target.value.trim();
    applyFilter();
  }, 200);
});

document.querySelectorAll(".tier-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tier-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    tierFilter = btn.dataset.tier;
    applyFilter();
  });
});

document.getElementById("tag-select").addEventListener("change", (e) => {
  tagFilter = e.target.value;
  applyFilter();
});

document.getElementById("clear-btn").addEventListener("click", () => {
  query = "";
  tierFilter = "all";
  tagFilter = "";
  document.getElementById("search").value = "";
  document
    .querySelectorAll(".tier-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('[data-tier="all"]').classList.add("active");
  document.getElementById("tag-select").value = "";
  applyFilter();
});

// Load index.json
fetch("index.json")
  .then((r) => r.json())
  .then((data) => {
    all = data;
    filtered = data;

    // Build tag list
    const tagCount = {};
    data.forEach((p) =>
      (p.tags ?? []).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)),
    );
    const topTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
    const sel = document.getElementById("tag-select");
    topTags.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = `${t} (${tagCount[t]})`;
      sel.appendChild(o);
    });

    // URL 파라미터 적용
    const params = new URLSearchParams(location.search);
    const qParam = params.get("q");
    const pParam = params.get("p");
    if (qParam) {
      query = qParam;
      document.getElementById("search").value = qParam;
    }

    render();

    // ?p=ID 로 직접 접근 시 해당 문제 바로 열기
    if (pParam) openProblem(+pParam, false);
  })
  .catch(() => {
    document.getElementById("content").innerHTML =
      '<div class="empty">index.json 로딩 실패</div>';
  });
