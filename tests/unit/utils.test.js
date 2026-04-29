import { describe, it, expect } from "vitest";
import {
  escHtml,
  fmtCount,
  matchesTier,
  fixImgPaths,
  filterProblems,
  getPaginationSlice,
  PER_PAGE,
} from "../../src/utils.js";

// ── escHtml ─────────────────────────────────────────────────────────

describe("escHtml", () => {
  it("이스케이프 불필요한 문자는 그대로 반환", () => {
    expect(escHtml("hello")).toBe("hello");
  });

  it("< > & 를 HTML 엔티티로 변환", () => {
    expect(escHtml("<b>test</b>")).toBe("&lt;b&gt;test&lt;/b&gt;");
    expect(escHtml("a & b")).toBe("a &amp; b");
  });

  it("XSS 스크립트 태그 무력화", () => {
    const result = escHtml("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("& 가 &amp;amp; 로 이중 인코딩되지 않아야 함", () => {
    expect(escHtml("&amp;")).toBe("&amp;amp;");
  });

  it("숫자를 문자열로 강제 변환", () => {
    expect(escHtml(42)).toBe("42");
    expect(escHtml(0)).toBe("0");
  });

  it("null/undefined 을 문자열로 처리", () => {
    expect(escHtml(null)).toBe("null");
    expect(escHtml(undefined)).toBe("undefined");
  });

  it("빈 문자열 반환", () => {
    expect(escHtml("")).toBe("");
  });

  it("따옴표도 이스케이프해야 함 (attribute context 보안을 위해)", () => {
    expect(escHtml('"hello"')).toBe("&quot;hello&quot;");
    expect(escHtml("'hello'")).toBe("&#039;hello&#039;");
  });
});

// ── fmtCount ─────────────────────────────────────────────────────────

describe("fmtCount", () => {
  it("falsy 값은 하이픈 반환", () => {
    expect(fmtCount(0)).toBe("-");
    expect(fmtCount(null)).toBe("-");
    expect(fmtCount(undefined)).toBe("-");
    expect(fmtCount("")).toBe("-");
  });

  it("10000 미만은 로케일 형식으로 반환", () => {
    expect(fmtCount(999)).toBe("999");
    expect(fmtCount(9999)).toBe("9,999");
  });

  it("10000 이상은 k 단위로 반환", () => {
    expect(fmtCount(10000)).toBe("10k");
    expect(fmtCount(50000)).toBe("50k");
    expect(fmtCount(123456)).toBe("123k");
  });

  it("경계값 9999 vs 10000", () => {
    expect(fmtCount(9999)).not.toContain("k");
    expect(fmtCount(10000)).toContain("k");
  });
});

// ── matchesTier ───────────────────────────────────────────────────────

describe("matchesTier", () => {
  it('"all" 필터는 모든 레벨에 매칭', () => {
    expect(matchesTier(0, "all")).toBe(true);
    expect(matchesTier(15, "all")).toBe(true);
    expect(matchesTier(null, "all")).toBe(true);
    expect(matchesTier(undefined, "all")).toBe(true);
  });

  it('"0" 필터는 레벨 0과 null/undefined 에 매칭', () => {
    expect(matchesTier(0, "0")).toBe(true);
    expect(matchesTier(null, "0")).toBe(true);
    expect(matchesTier(undefined, "0")).toBe(true);
    expect(matchesTier(1, "0")).toBe(false);
  });

  it("범위 필터 — 경계값 포함", () => {
    expect(matchesTier(1, "1-5")).toBe(true);
    expect(matchesTier(5, "1-5")).toBe(true);
    expect(matchesTier(3, "1-5")).toBe(true);
  });

  it("범위 필터 — 범위 밖 제외", () => {
    expect(matchesTier(0, "1-5")).toBe(false);
    expect(matchesTier(6, "1-5")).toBe(false);
  });

  it("Silver 범위 (6-10)", () => {
    expect(matchesTier(6, "6-10")).toBe(true);
    expect(matchesTier(10, "6-10")).toBe(true);
    expect(matchesTier(11, "6-10")).toBe(false);
  });

  it("Ruby 범위 (26-30)", () => {
    expect(matchesTier(26, "26-30")).toBe(true);
    expect(matchesTier(30, "26-30")).toBe(true);
    expect(matchesTier(25, "26-30")).toBe(false);
  });
});

// ── fixImgPaths ────────────────────────────────────────────────────────

describe("fixImgPaths", () => {
  it("상대 경로 이미지를 problems/{id}/ 로 변환", () => {
    const html = '<img src="image.png">';
    expect(fixImgPaths(html, 1000)).toBe('<img src="problems/1000/image.png">');
  });

  it("이미 절대 URL (https://) 은 변환하지 않음", () => {
    const html = '<img src="https://example.com/img.png">';
    expect(fixImgPaths(html, 1000)).toBe(html);
  });

  it("프로토콜 상대 URL (//) 은 변환하지 않음", () => {
    const html = '<img src="//cdn.example.com/img.png">';
    expect(fixImgPaths(html, 1000)).toBe(html);
  });

  it("이미 problems/ 로 시작하면 변환하지 않음", () => {
    const html = '<img src="problems/1000/image.png">';
    expect(fixImgPaths(html, 1000)).toBe(html);
  });

  it("루트 절대 경로 / 로 시작하면 변환하지 않음", () => {
    const html = '<img src="/static/img.png">';
    expect(fixImgPaths(html, 1000)).toBe(html);
  });

  it("큰따옴표와 작은따옴표 모두 처리", () => {
    const dq = `<img src="img.png">`;
    const sq = `<img src='img.png'>`;
    expect(fixImgPaths(dq, 5)).toBe(`<img src="problems/5/img.png">`);
    expect(fixImgPaths(sq, 5)).toBe(`<img src='problems/5/img.png'>`);
  });

  it("HTML 안에 다른 속성이 있는 경우도 처리", () => {
    const html = '<img class="math" src="formula.svg" alt="수식">';
    expect(fixImgPaths(html, 2000)).toContain("problems/2000/formula.svg");
  });

  it("여러 이미지가 있는 경우 모두 변환", () => {
    const html = '<img src="a.png"> <img src="b.png">';
    const result = fixImgPaths(html, 100);
    expect(result).toContain("problems/100/a.png");
    expect(result).toContain("problems/100/b.png");
  });

  it("img 태그가 없으면 원본 반환", () => {
    const html = "<p>텍스트만 있는 문단</p>";
    expect(fixImgPaths(html, 1)).toBe(html);
  });
});

// ── filterProblems ─────────────────────────────────────────────────────

describe("filterProblems", () => {
  const problems = [
    { id: 1, title: "두 수의 합", level: 2, tags: ["math", "implementation"] },
    { id: 2, title: "BFS 탐색", level: 11, tags: ["bfs", "graph"] },
    { id: 3, title: "동적 프로그래밍", level: 15, tags: ["dp"] },
    { id: 4, title: "Unrated 문제", level: null, tags: [] },
    { id: 5, title: "수학 응용", level: 0, tags: ["math"] },
  ];

  it("기본 (필터 없음) 은 전체 반환", () => {
    expect(filterProblems(problems)).toHaveLength(5);
  });

  it('tierFilter="all" 은 전체 반환', () => {
    expect(filterProblems(problems, { tierFilter: "all" })).toHaveLength(5);
  });

  it('tierFilter="0" 은 Unrated(level null, 0) 만 반환', () => {
    const result = filterProblems(problems, { tierFilter: "0" });
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining([4, 5]));
    expect(result).toHaveLength(2);
  });

  it('tierFilter="1-5" 은 Bronze 문제만 반환', () => {
    const result = filterProblems(problems, { tierFilter: "1-5" });
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it("tagFilter 로 특정 태그 필터링", () => {
    const result = filterProblems(problems, { tagFilter: "math" });
    expect(result.map((p) => p.id)).toEqual(expect.arrayContaining([1, 5]));
    expect(result).toHaveLength(2);
  });

  it("query 로 제목 검색 (대소문자 무시)", () => {
    const result = filterProblems(problems, { query: "bfs" });
    expect(result.map((p) => p.id)).toEqual([2]);
  });

  it("query 로 문제 번호 검색", () => {
    const result = filterProblems(problems, { query: "3" });
    expect(result.map((p) => p.id)).toContain(3);
  });

  it("tierFilter + tagFilter 조합", () => {
    const result = filterProblems(problems, {
      tierFilter: "1-5",
      tagFilter: "math",
    });
    expect(result.map((p) => p.id)).toEqual([1]);
  });

  it("검색 결과 없으면 빈 배열", () => {
    expect(
      filterProblems(problems, { query: "존재하지않는문제XYZ" }),
    ).toHaveLength(0);
  });

  it("tags 없는 문제에 tagFilter 적용 시 제외", () => {
    const result = filterProblems(problems, { tagFilter: "dp" });
    expect(result.map((p) => p.id)).toEqual([3]);
  });

  it("빈 problems 배열은 빈 배열 반환", () => {
    expect(filterProblems([], { tierFilter: "all" })).toHaveLength(0);
  });
});

// ── getPaginationSlice ─────────────────────────────────────────────────

describe("getPaginationSlice", () => {
  const items = Array.from({ length: 123 }, (_, i) => i + 1);

  it("첫 페이지 슬라이스", () => {
    const {
      items: page,
      start,
      end,
      totalPages,
    } = getPaginationSlice(items, 1, 50);
    expect(page).toHaveLength(50);
    expect(page[0]).toBe(1);
    expect(start).toBe(0);
    expect(end).toBe(50);
    expect(totalPages).toBe(3);
  });

  it("중간 페이지 슬라이스", () => {
    const { items: page, start } = getPaginationSlice(items, 2, 50);
    expect(page[0]).toBe(51);
    expect(start).toBe(50);
  });

  it("마지막 페이지 — 나머지 아이템", () => {
    const { items: page, end, total } = getPaginationSlice(items, 3, 50);
    expect(page).toHaveLength(23);
    expect(end).toBe(123);
    expect(total).toBe(123);
  });

  it("아이템 수가 정확히 PER_PAGE 인 경우", () => {
    const exact = Array.from({ length: 50 }, (_, i) => i);
    const { totalPages } = getPaginationSlice(exact, 1, 50);
    expect(totalPages).toBe(1);
  });

  it("아이템 1개", () => {
    const { items: page, totalPages } = getPaginationSlice([1], 1, 50);
    expect(page).toHaveLength(1);
    expect(totalPages).toBe(1);
  });

  it("빈 배열", () => {
    const { items: page, totalPages, total } = getPaginationSlice([], 1, 50);
    expect(page).toHaveLength(0);
    expect(totalPages).toBe(0);
    expect(total).toBe(0);
  });

  it("PER_PAGE+1 개일 때 페이지 2개", () => {
    const arr = Array.from({ length: 51 }, (_, i) => i);
    const { totalPages } = getPaginationSlice(arr, 1, 50);
    expect(totalPages).toBe(2);
  });

  it("기본 perPage 는 PER_PAGE(50) 적용", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const { totalPages } = getPaginationSlice(arr, 1);
    expect(totalPages).toBe(Math.ceil(100 / PER_PAGE));
  });
});
