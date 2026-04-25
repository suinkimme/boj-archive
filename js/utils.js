export const PER_PAGE = 50;

// prettier-ignore
export const TIER_NAMES = [
  "Unrated",
  "Bronze V","Bronze IV","Bronze III","Bronze II","Bronze I",
  "Silver V","Silver IV","Silver III","Silver II","Silver I",
  "Gold V",  "Gold IV",  "Gold III",  "Gold II",  "Gold I",
  "Platinum V","Platinum IV","Platinum III","Platinum II","Platinum I",
  "Diamond V","Diamond IV","Diamond III","Diamond II","Diamond I",
  "Ruby V",  "Ruby IV",  "Ruby III",  "Ruby II",  "Ruby I",
];

// prettier-ignore
export const TIER_COLORS = [
  "#64748b",
  "#ad5600","#ad5600","#ad5600","#ad5600","#ad5600",
  "#435f7a","#435f7a","#435f7a","#435f7a","#435f7a",
  "#d97706","#d97706","#d97706","#d97706","#d97706",
  "#059669","#059669","#059669","#059669","#059669",
  "#0284c7","#0284c7","#0284c7","#0284c7","#0284c7",
  "#e11d48","#e11d48","#e11d48","#e11d48","#e11d48",
];

export function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function fmtCount(n) {
  if (!n) return "-";
  return n >= 10000 ? (n / 1000).toFixed(0) + "k" : n.toLocaleString();
}

export function matchesTier(level, f) {
  if (f === "all") return true;
  if (f === "0") return level === 0 || level == null;
  const [a, b] = f.split("-").map(Number);
  return level >= a && level <= b;
}

export function fixImgPaths(html, id) {
  return html.replace(
    /(<img\s[^>]*src=["'])(?!https?:\/\/|\/\/|\/|problems\/)(.*?)(["'])/gi,
    (_, pre, src, suf) => `${pre}problems/${id}/${src}${suf}`,
  );
}

export function filterProblems(
  problems,
  { tierFilter = "all", tagFilter = "", query = "" } = {},
) {
  return problems.filter((p) => {
    if (!matchesTier(p.level, tierFilter)) return false;
    if (tagFilter && !p.tags?.includes(tagFilter)) return false;
    if (query) {
      const q = query.toLowerCase();
      return String(p.id).includes(q) || p.title?.toLowerCase().includes(q);
    }
    return true;
  });
}

export function getPaginationSlice(items, page, perPage = PER_PAGE) {
  const total = items.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total,
    totalPages,
    start,
    end: Math.min(start + perPage, total),
  };
}
