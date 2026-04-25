// Pure utility functions — mirrors implementations in js/main.js.
// Any change here must be reflected there, and vice versa.

export const PER_PAGE = 50;

export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function fmtCount(n) {
  if (!n) return '-';
  return n >= 10000 ? (n / 1000).toFixed(0) + 'k' : n.toLocaleString();
}

export function matchesTier(level, f) {
  if (f === 'all') return true;
  if (f === '0') return level === 0 || level == null;
  const [a, b] = f.split('-').map(Number);
  return level >= a && level <= b;
}

export function fixImgPaths(html, id) {
  return html.replace(
    /(<img\s[^>]*src=["'])(?!https?:\/\/|\/\/|\/|problems\/)(.*?)(["'])/gi,
    (_, pre, src, suf) => `${pre}problems/${id}/${src}${suf}`
  );
}

export function filterProblems(problems, { tierFilter = 'all', tagFilter = '', query = '' } = {}) {
  return problems.filter(p => {
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
