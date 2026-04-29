import { test, expect } from "@playwright/test";

// Pyodide/JSCPP 로딩 포함 넉넉한 타임아웃
test.setTimeout(120000);

// 문제 1000 (A+B): 샘플 입력 "1 2\n" → 출력 "3\n"
async function openProblem1000(page) {
  await page.goto("/?p=1000");
  await page.waitForSelector(".modal-overlay.open", { timeout: 15000 });
  // 모달 콘텐츠 로딩 완료 대기 (스피너 사라짐)
  await page.waitForFunction(
    () => !document.querySelector("#modal-content .spinner"),
    { timeout: 15000 },
  );
  await expect(page.locator("#py-runner")).toBeVisible({ timeout: 5000 });
}

test.describe("Python 코드 실행기", () => {
  test.beforeEach(async ({ page }) => {
    await openProblem1000(page);
  });

  test("Hello World 실행", async ({ page }) => {
    await page.fill("#py-code", 'print("hello world")');
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    const output = await detail.locator(".py-detail-actual").textContent();
    expect(output.trim()).toBe("hello world");
  });

  test("샘플 케이스 실행 — A+B", async ({ page }) => {
    // 문제 1000 풀이 코드로 샘플 케이스 실행
    await page.fill(
      "#py-code",
      "a, b = map(int, input().split())\nprint(a + b)",
    );

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    // 샘플 1: "1 2" → "3" → pass 상태
    const chip = page.locator(".py-chip-case").first();
    await expect(chip).toHaveClass(/pass/);
  });

  test("기대 출력과 일치하면 pass 상태", async ({ page }) => {
    await page.fill("#py-code", "print(1 + 1)");
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);
    await detail.locator(".py-detail-expected").fill("2");

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    await expect(lastChip).toHaveClass(/pass/);
  });

  test("기대 출력과 불일치하면 fail 상태", async ({ page }) => {
    await page.fill("#py-code", "print(1 + 1)");
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);
    await detail.locator(".py-detail-expected").fill("999");

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    await expect(lastChip).toHaveClass(/fail/);
  });

  test("예외 발생 시 error 상태", async ({ page }) => {
    // 사용자 케이스를 추가하지 않고 샘플 케이스(1개)만 실행해 메모리 부담 최소화
    await page.fill("#py-code", 'raise ValueError("의도적 오류")');

    const sampleChip = page.locator(".py-chip-case").first();
    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    await expect(sampleChip).toHaveClass(/error/);
  });

  test("사용자 케이스 삭제", async ({ page }) => {
    await page.click("#py-add-btn");
    const beforeCount = await page.locator(".py-chip-case").count();

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);
    await expect(detail).toBeVisible();
    await detail.locator(".py-detail-del").click();

    expect(await page.locator(".py-chip-case").count()).toBe(beforeCount - 1);
  });

  test("전체 실행 후 통과 수 표시", async ({ page }) => {
    await page.fill(
      "#py-code",
      "a, b = map(int, input().split())\nprint(a + b)",
    );
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);
    await detail.locator(".py-detail-input").fill("3 4");
    await detail.locator(".py-detail-expected").fill("7");

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    const status = await page.locator("#py-status").textContent();
    expect(status).toMatch(/\d+\s*\/\s*\d+\s*통과/);
  });
});

test.describe("C++ 코드 실행기", () => {
  test.beforeEach(async ({ page }) => {
    await openProblem1000(page);
    await page.selectOption("#runner-lang", "cpp");
  });

  test("Hello World 실행 (cout)", async ({ page }) => {
    await page.fill(
      "#py-code",
      '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "hello world" << endl;\n  return 0;\n}',
    );
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    const output = await detail.locator(".py-detail-actual").textContent();
    expect(output.trim()).toBe("hello world");
  });

  test("bits/stdc++.h 치환 후 실행", async ({ page }) => {
    await page.fill(
      "#py-code",
      "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  cout << 42 << endl;\n  return 0;\n}",
    );
    await page.click("#py-add-btn");

    const lastChip = page.locator(".py-chip-case").last();
    const idx = await lastChip.getAttribute("data-idx");
    const detail = page.locator(`.py-detail[data-idx="${idx}"]`);

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    const output = await detail.locator(".py-detail-actual").textContent();
    expect(output.trim()).toBe("42");
  });

  test("A+B 샘플 케이스 pass", async ({ page }) => {
    await page.fill(
      "#py-code",
      "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << endl;\n  return 0;\n}",
    );

    await page.click("#py-run-all-btn");
    await expect(page.locator("#py-run-all-btn")).toBeEnabled({
      timeout: 90000,
    });

    const chip = page.locator(".py-chip-case").first();
    await expect(chip).toHaveClass(/pass/);
  });
});

test.describe("언어 전환", () => {
  test.beforeEach(async ({ page }) => {
    await openProblem1000(page);
  });

  test("C++ 전환 시 placeholder 변경", async ({ page }) => {
    await page.selectOption("#runner-lang", "cpp");
    const placeholder = await page
      .locator("#py-code")
      .getAttribute("placeholder");
    expect(placeholder).toContain("#include");
  });

  test("언어 전환 후 코드 복원", async ({ page }) => {
    await page.fill("#py-code", "# 저장할 파이썬 코드");
    await page.selectOption("#runner-lang", "cpp");
    await page.selectOption("#runner-lang", "python");
    expect(await page.locator("#py-code").inputValue()).toBe(
      "# 저장할 파이썬 코드",
    );
  });

  test("힌트 텍스트가 언어에 맞게 변경", async ({ page }) => {
    expect(await page.locator("#runner-lang-hint").textContent()).toContain(
      "Pyodide",
    );
    await page.selectOption("#runner-lang", "cpp");
    expect(await page.locator("#runner-lang-hint").textContent()).toContain(
      "JSCPP",
    );
  });
});
