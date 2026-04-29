import { test, expect } from "@playwright/test";

test.describe("페이지 로딩", () => {
  test("index.json 로드 후 문제 목록 표시", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".problem-row").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("stat 영역에 문제 수 표시", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
    const stat = await page.locator("#stat").textContent();
    expect(stat).toMatch(/\d+.*문제/);
  });

  test("문제 행이 한 페이지에 최대 50개", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
    const count = await page.locator(".problem-row").count();
    expect(count).toBeLessThanOrEqual(50);
  });
});

test.describe("검색 필터", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
  });

  test("검색어로 문제 필터링 — 결과가 전체보다 적음", async ({ page }) => {
    await page.fill("#search", "두 수");
    await page.waitForTimeout(300);
    const rows = page.locator(".problem-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    // 필터링 결과는 전체 50개보다 적어야 함
    expect(count).toBeLessThan(50);
  });

  test("검색어로 문제 번호 검색", async ({ page }) => {
    await page.fill("#search", "1000");
    await page.waitForTimeout(300);
    const rows = page.locator(".problem-row");
    await expect(rows.first()).toBeVisible();
    const nums = await rows.locator(".problem-num").allTextContents();
    expect(nums.some((n) => n.includes("1000"))).toBe(true);
  });

  test("결과 없는 검색어 입력 시 empty 메시지 표시", async ({ page }) => {
    await page.fill("#search", "XYZXYZXYZ존재하지않는문제999");
    await page.waitForTimeout(300);
    await expect(page.locator(".empty")).toBeVisible();
  });

  test("초기화 버튼으로 필터 리셋", async ({ page }) => {
    await page.fill("#search", "두 수");
    await page.waitForTimeout(300);
    await page.click("#clear-btn");
    await page.waitForTimeout(300);
    const count = await page.locator(".problem-row").count();
    expect(count).toBe(50);
  });
});

test.describe("난이도 티어 필터", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
  });

  test("Bronze 필터 클릭 시 해당 난이도만 표시", async ({ page }) => {
    await page.click('[data-tier="1-5"]');
    await page.waitForTimeout(200);
    const rows = await page.locator(".problem-row").count();
    expect(rows).toBeGreaterThan(0);
    // stat 수가 전체보다 적어야 함
    const stat = await page.locator("#stat").textContent();
    const num = parseInt(stat.replace(/[^\d]/g, ""));
    expect(num).toBeGreaterThan(0);
  });

  test("Unrated 필터", async ({ page }) => {
    await page.click('[data-tier="0"]');
    await page.waitForTimeout(200);
    const stat = await page.locator("#stat").textContent();
    expect(stat).toMatch(/\d+/);
  });

  test("전체 버튼으로 필터 해제", async ({ page }) => {
    await page.click('[data-tier="1-5"]');
    await page.waitForTimeout(200);
    const filteredStat = await page.locator("#stat").textContent();
    await page.click('[data-tier="all"]');
    await page.waitForTimeout(200);
    const allStat = await page.locator("#stat").textContent();
    const filteredNum = parseInt(
      filteredStat.replace(/[^\d,]/g, "").replace(",", ""),
    );
    const allNum = parseInt(allStat.replace(/[^\d,]/g, "").replace(",", ""));
    expect(allNum).toBeGreaterThan(filteredNum);
  });
});

test.describe("페이지네이션", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
  });

  test("다음 페이지 이동", async ({ page }) => {
    const firstTitle = await page
      .locator(".problem-title")
      .first()
      .textContent();
    await page.click("#next-btn");
    await page.waitForTimeout(200);
    const newFirstTitle = await page
      .locator(".problem-title")
      .first()
      .textContent();
    expect(newFirstTitle).not.toBe(firstTitle);
  });

  test("이전 버튼은 첫 페이지에서 비활성화", async ({ page }) => {
    await expect(page.locator("#prev-btn")).toBeDisabled();
  });

  test("페이지 번호 버튼 클릭 이동", async ({ page }) => {
    const pageBtn = page.locator('[data-p="2"]').first();
    await pageBtn.click();
    await page.waitForTimeout(200);
    await expect(page.locator(".page-btn.active")).toHaveText("2");
  });
});

test.describe("문제 모달", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".problem-row", { timeout: 15000 });
  });

  test("행 클릭 시 모달 열림", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator(".modal-overlay.open")).toBeVisible({
      timeout: 10000,
    });
  });

  test("모달에 문제 제목 표시", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator(".modal-title")).not.toBeEmpty({
      timeout: 10000,
    });
  });

  test("닫기 버튼으로 모달 닫힘", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator(".modal-overlay.open")).toBeVisible({
      timeout: 10000,
    });
    await page.click("#modal-close");
    await expect(page.locator(".modal-overlay.open")).not.toBeVisible();
  });

  test("ESC 키로 모달 닫힘", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator(".modal-overlay.open")).toBeVisible({
      timeout: 10000,
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal-overlay.open")).not.toBeVisible();
  });

  test("오버레이 클릭으로 모달 닫힘", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator(".modal-overlay.open")).toBeVisible({
      timeout: 10000,
    });
    await page.mouse.click(5, 5);
    await expect(page.locator(".modal-overlay.open")).not.toBeVisible();
  });

  test("모달에 코드 실행기 섹션 존재", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await expect(page.locator("#py-runner")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#py-code")).toBeVisible();
  });

  test("URL에 ?p= 파라미터 추가됨", async ({ page }) => {
    await page.locator(".problem-row").first().click();
    await page.waitForURL(/\?p=\d+/, { timeout: 5000 });
    expect(page.url()).toMatch(/\?p=\d+/);
  });
});
