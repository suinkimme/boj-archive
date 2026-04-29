import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateRiskReport,
  compareBaseline,
  createBaseline,
  createIssueFingerprint,
  extractImageRefs,
  normalizeComparablePath,
  parseArgs,
  scanArchive,
} from "../../scripts/archive-quality.mjs";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../../scripts/archive-quality.mjs", import.meta.url));
const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("archive quality scanner", () => {
  it("passes a clean fixture and computes basic stats", async () => {
    const root = await createArchive({
      index: [
        indexEntry({ id: 1000, tags: ["math", "dp"] }),
        indexEntry({ id: 2000, title: "No Samples", level: 0, tags: [] }),
      ],
      problems: {
        1000: problemEntry({
          id: 1000,
          tags: ["dp", "math"],
          description: '<IMG\n alt="ok"\n SRC = "img&amp;.png?cache=1#hash">',
          input: "<img src=./sub/pic.png>",
          hint: "<p>hint</p>",
        }),
        2000: problemEntry({
          id: 2000,
          title: "No Samples",
          level: 0,
          tags: [],
          samples: [],
        }),
      },
      files: {
        "problems/1000/img&.png": "",
        "problems/1000/sub/pic.png": "",
      },
    });

    const result = await scanArchive({ root });

    expect(result.exitCode).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.summary.indexProblemCount).toBe(2);
    expect(result.summary.problemDirectoryCount).toBe(2);
    expect(result.summary.problemJsonCount).toBe(2);
    expect(result.summary.imageFileCount).toBe(2);
    expect(result.summary.samplesMissingCount).toBe(1);
    expect(result.summary.hintPresentCount).toBe(1);
    expect(result.summary.tagsMissingCount).toBe(1);
    expect(result.summary.levelCounts.zero).toBe(1);
    expect(result.imageRefs.total).toBe(2);
    expect(result.imageRefs.missing).toBe(0);
  });

  it("reports missing problem json, orphan dirs, duplicates, invalid problem json, and keeps scanning", async () => {
    const root = await createArchive({
      index: [
        indexEntry({ id: 1 }),
        indexEntry({ id: 1, title: "Duplicate" }),
        indexEntry({ id: 2 }),
        indexEntry({ id: 4 }),
        indexEntry({ id: 5 }),
      ],
      problems: {
        1: problemEntry({ id: 1 }),
        3: problemEntry({ id: 3 }),
        4: "{ invalid json",
        5: problemEntry({ id: 5, samples: [] }),
      },
    });

    const result = await scanArchive({ root });
    const types = result.issues.map((issue) => issue.type);

    expect(result.exitCode).toBe(1);
    expect(types).toContain("duplicate-index-id");
    expect(types).toContain("missing-problem-json");
    expect(types).toContain("orphan-problem-dir");
    expect(types).toContain("invalid-problem-json");
    expect(result.summary.problemJsonCount).toBe(4);
    expect(result.summary.samplesMissingCount).toBe(1);
  });

  it("wraps invalid index.json as a JSON-mode failure result", async () => {
    const root = await createArchive({
      rawIndex: "{ invalid json",
      problems: {
        1: problemEntry({ id: 1 }),
      },
    });

    const result = await scanArchive({ root, json: true });

    expect(result.exitCode).toBe(1);
    expect(result.issues.map((issue) => issue.type)).toContain("invalid-index-json");
  });

  it("normalizes id and tag ordering but reports raw scalar metadata mismatches", async () => {
    const root = await createArchive({
      index: [
        indexEntry({ id: 10, tags: ["b", "a"] }),
        indexEntry({ id: 11, accepted_user_count: 1 }),
      ],
      problems: {
        10: problemEntry({ id: "10", tags: ["a", "b"] }),
        11: problemEntry({ id: 11, accepted_user_count: "1" }),
      },
    });

    const result = await scanArchive({ root });
    const mismatches = result.issues.filter((issue) => issue.type === "metadata-mismatch");

    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      id: 11,
      field: "accepted_user_count",
      indexValue: 1,
      problemValue: "1",
    });
  });

  it("classifies image refs and rejects traversal with path containment checks", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({
          id: 1,
          description: [
            '<IMG SRC = "ok.png?x=1#hash">',
            "<img src='./sub/file.png'>",
            "<img src=missing.png>",
            '<img src="https://example.com/a.png">',
            '<img src="//cdn.example.com/a.png">',
            '<img src="/root.png">',
            '<img src="data:image/png;base64,abc">',
            '<img src="../escape.png">',
            '<img src="encoded&#x2F;pic.png">',
          ].join("\n"),
        }),
      },
      files: {
        "problems/1/ok.png": "",
        "problems/1/sub/file.png": "",
        "problems/1/encoded/pic.png": "",
      },
    });

    const result = await scanArchive({ root });
    const types = result.issues.map((issue) => issue.type);

    expect(result.exitCode).toBe(1);
    expect(result.imageRefs.total).toBe(9);
    expect(result.imageRefs.relative).toBe(5);
    expect(result.imageRefs.external).toBe(2);
    expect(result.imageRefs.absoluteOrScheme).toBe(2);
    expect(result.imageRefs.missing).toBe(1);
    expect(types).toContain("missing-image");
    expect(types).toContain("image-path-traversal");
  });

  it("extracts case-insensitive quoted, unquoted, spaced, multiline, and entity-decoded img src values", () => {
    const refs = extractImageRefs(`
      <IMG
        alt="x"
        SRC = "a&amp;b.png"
      >
      <img src='./c.png'>
      <img src=d.png>
    `);

    expect(refs.map((ref) => ref.src)).toEqual(["a&b.png", "./c.png", "d.png"]);
  });

  it("reports risky HTML warnings without failing the scan", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 7 })],
      problems: {
        7: problemEntry({
          id: 7,
          description: [
            "<script>alert(1)</script>",
            "<IFRAME src='x'></IFRAME>",
            "<object data='x'></object>",
            "<embed src='x'>",
            '<img onerror = "alert(1)">',
            '<a href=" java&#x73;cript:alert(1)">x</a>',
            "<style>.x{}</style>",
          ].join(""),
        }),
      },
    });

    const result = await scanArchive({ root });
    const riskTypes = result.riskyHtml.map((issue) => issue.type);

    expect(result.exitCode).toBe(0);
    expect(riskTypes).toEqual(expect.arrayContaining([
      "script-tag",
      "iframe-tag",
      "object-tag",
      "embed-tag",
      "inline-event-handler",
      "javascript-url",
      "style-tag",
    ]));
    expect(riskTypes).toHaveLength(7);
  });

  it("sorts issues, risky HTML, and largest problem files deterministically", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 20 }), indexEntry({ id: 10 })],
      problems: {
        20: problemEntry({ id: 20, title: "wrong", description: "<style></style>" }),
        10: problemEntry({ id: 10, title: "wrong", description: "<script></script>" }),
      },
    });

    const result = await scanArchive({ root, top: 2 });

    expect(result.issues.map((issue) => issue.id)).toEqual([10, 20]);
    expect(result.riskyHtml.map((issue) => issue.id)).toEqual([10, 20]);
    expect(result.summary.largestProblemJson).toHaveLength(2);
  });

  it("creates stable fingerprints from structured fields instead of message text or snippets", () => {
    const baseIssue = {
      severity: "error",
      category: "image",
      type: "missing-image",
      id: 1,
      field: "description",
      path: "/tmp/archive/problems/1/missing.png",
      src: "missing.png",
    };
    const first = createIssueFingerprint({
      ...baseIssue,
      message: "old wording",
    }, { root: "/tmp/archive" });
    const second = createIssueFingerprint({
      ...baseIssue,
      message: "new wording",
    }, { root: "/tmp/archive" });
    const snippetA = createIssueFingerprint({
      severity: "warning",
      category: "html",
      type: "script-tag",
      id: 1,
      field: "description",
      snippet: "<script>alert(1)</script>",
    });
    const snippetB = createIssueFingerprint({
      severity: "warning",
      category: "html",
      type: "script-tag",
      id: 1,
      field: "description",
      snippet: "<script>alert(2)</script>",
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.hash).toBe(second.hash);
    expect(snippetA.fingerprint).toBe(snippetB.fingerprint);
    expect(createIssueFingerprint({ ...baseIssue, id: 2 }, { root: "/tmp/archive" }).fingerprint)
      .not.toBe(first.fingerprint);
    expect(createIssueFingerprint({
      severity: "error",
      category: "image",
      type: "missing-image",
      id: 1,
      field: "input",
      path: "/tmp/archive/problems/1/missing.png",
      src: "missing.png",
    }, { root: "/tmp/archive" }).fingerprint).not.toBe(first.fingerprint);
    expect(createIssueFingerprint({
      severity: "error",
      category: "image",
      type: "missing-image",
      id: 1,
      field: "description",
      path: "/tmp/archive/problems/1/other.png",
      src: "other.png",
    }, { root: "/tmp/archive" }).fingerprint).not.toBe(first.fingerprint);
  });

  it("normalizes comparable paths and strips absolute roots from baselines", async () => {
    expect(normalizeComparablePath("C:\\repo\\problems\\1\\problem.json", "C:\\repo"))
      .toBe("problems/1/problem.json");
    expect(normalizeComparablePath("/tmp/repo/problems/1/problem.json", "/tmp/repo"))
      .toBe("problems/1/problem.json");

    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({ id: 1, description: '<img src="missing.png">' }),
      },
    });
    const absoluteResult = await scanArchive({ root });
    const relativeResult = await scanArchive({ root: path.relative(process.cwd(), root) });
    const absoluteBaseline = createBaseline(absoluteResult);
    const relativeBaseline = createBaseline(relativeResult);

    expect(absoluteBaseline.issues.map((issue) => issue.fingerprint))
      .toEqual(relativeBaseline.issues.map((issue) => issue.fingerprint));
    expect(JSON.stringify(absoluteBaseline)).not.toContain(root);
  });

  it("compares baselines into new, resolved, and unchanged issues", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 }), indexEntry({ id: 2 })],
      problems: {
        1: problemEntry({ id: 1, description: '<img src="missing.png">' }),
        2: problemEntry({ id: 2 }),
      },
    });
    const baseline = createBaseline(await scanArchive({ root }));

    await fs.writeFile(path.join(root, "problems/1/missing.png"), "");
    await fs.writeFile(
      path.join(root, "problems/2/problem.json"),
      `${JSON.stringify(problemEntry({
        id: 2,
        description: '<img src="new-missing.png">',
      }), null, 2)}\n`,
    );

    const comparison = compareBaseline(await scanArchive({ root }), baseline);

    expect(comparison.exitCode).toBe(1);
    expect(comparison.newIssues.map((issue) => issue.type)).toEqual(["missing-image"]);
    expect(comparison.resolvedIssues.map((issue) => issue.type)).toEqual(["missing-image"]);
    expect(comparison.unchangedIssues).toEqual([]);
  });

  it("calculates heuristic risk scores deterministically", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 }), indexEntry({ id: 2 })],
      problems: {
        1: problemEntry({
          id: 1,
          description: [
            '<img src="missing.png">',
            "<script>alert(1)</script>",
            '<a href="javascript:alert(1)">x</a>',
            "<style>.x{}</style>",
          ].join(""),
        }),
        2: problemEntry({
          id: 2,
          description: "x".repeat(70 * 1024),
        }),
      },
    });

    const result = await scanArchive({ root });
    const report = calculateRiskReport(result, { top: 2 });

    expect(report.topProblems.map((problem) => problem.id)).toEqual([1, 2]);
    expect(report.topProblems[0].score).toBe(130);
    expect(report.topProblems[0].reasons.map((reason) => reason.type)).toEqual([
      "javascript-url",
      "missing-image",
      "script-tag",
      "style-tag",
    ]);
    expect(report.topProblems[1].reasons).toEqual([
      expect.objectContaining({ type: "very-large-problem-json", score: 5 }),
    ]);
    expect(report.byReason["script-tag"]).toEqual({ count: 1, score: 50 });
  });
});

describe("archive quality CLI", () => {
  it("--json prints parseable JSON to stdout on success", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({ id: 1 }),
      },
    });

    const { stdout, stderr } = await execNode([cliPath, "--root", root, "--json"]);
    const parsed = JSON.parse(stdout);

    expect(stderr).toBe("");
    expect(parsed.exitCode).toBe(0);
  });

  it("--json prints parseable JSON to stdout on non-zero failures", async () => {
    const root = await createArchive({
      rawIndex: "{ invalid json",
      problems: {},
    });

    const { stdout, stderr, exitCode } = await execNode([cliPath, "--root", root, "--json"]);
    const parsed = JSON.parse(stdout);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    expect(parsed.exitCode).toBe(1);
    expect(parsed.issues[0].type).toBe("invalid-index-json");
  });

  it("rejects invalid --top values as JSON-mode argument errors", async () => {
    expect(() => parseArgs(["--top", "0"])).toThrow("--top requires a positive integer");
    expect(() => parseArgs(["--top", "1.5"])).toThrow("--top requires a positive integer");

    const { stdout, stderr, exitCode } = await execNode([cliPath, "--top", "0", "--json"]);
    const parsed = JSON.parse(stdout);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    expect(parsed.issues[0].type).toBe("argument-error");
  });

  it("--write-baseline writes deterministic JSON and reports write status separately", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({ id: 1, description: '<img src="missing.png">' }),
      },
    });
    const baselinePath = path.join(root, "archive-quality.baseline.json");

    const first = await execNode([
      cliPath,
      "--root",
      root,
      "--write-baseline",
      baselinePath,
      "--json",
    ]);
    const firstParsed = JSON.parse(first.stdout);
    const firstText = await fs.readFile(baselinePath, "utf8");
    const second = await execNode([
      cliPath,
      "--root",
      root,
      "--write-baseline",
      baselinePath,
      "--json",
    ]);
    const secondText = await fs.readFile(baselinePath, "utf8");

    expect(first.stderr).toBe("");
    expect(second.stderr).toBe("");
    expect(first.exitCode).toBe(1);
    expect(firstParsed.exitCode).toBe(1);
    expect(firstParsed.baselineWrite).toMatchObject({
      status: "written",
      issueCount: 1,
      errorCount: 1,
      warningCount: 0,
    });
    expect(JSON.parse(firstText).issues.map((issue) => issue.type)).toEqual(["missing-image"]);
    expect(firstText).toBe(secondText);
    expect(firstText).not.toContain(root);
  });

  it("--compare-baseline passes unchanged known errors and reports resolved errors", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({ id: 1, description: '<img src="missing.png">' }),
      },
    });
    const baselinePath = path.join(root, "archive-quality.baseline.json");
    await execNode([cliPath, "--root", root, "--write-baseline", baselinePath, "--json"]);

    const unchanged = await execNode([
      cliPath,
      "--root",
      root,
      "--compare-baseline",
      baselinePath,
      "--json",
    ]);
    const unchangedParsed = JSON.parse(unchanged.stdout);

    await fs.writeFile(path.join(root, "problems/1/missing.png"), "");
    const resolved = await execNode([
      cliPath,
      "--root",
      root,
      "--compare-baseline",
      baselinePath,
      "--json",
    ]);
    const resolvedParsed = JSON.parse(resolved.stdout);

    expect(unchanged.stderr).toBe("");
    expect(unchanged.exitCode).toBe(0);
    expect(unchangedParsed.baselineCompare.counts.unchangedIssues.total).toBe(1);
    expect(unchangedParsed.baselineCompare.counts.newIssues.total).toBe(0);
    expect(resolved.stderr).toBe("");
    expect(resolved.exitCode).toBe(0);
    expect(resolvedParsed.baselineCompare.counts.resolvedIssues.total).toBe(1);
  });

  it("--compare-baseline fails new errors but not new warnings", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 }), indexEntry({ id: 2 })],
      problems: {
        1: problemEntry({ id: 1 }),
        2: problemEntry({ id: 2 }),
      },
    });
    const baselinePath = path.join(root, "archive-quality.baseline.json");
    await execNode([cliPath, "--root", root, "--write-baseline", baselinePath, "--json"]);

    await fs.writeFile(
      path.join(root, "problems/1/problem.json"),
      `${JSON.stringify(problemEntry({
        id: 1,
        description: "<script>alert(1)</script>",
      }), null, 2)}\n`,
    );
    const warningOnly = await execNode([
      cliPath,
      "--root",
      root,
      "--compare-baseline",
      baselinePath,
      "--json",
    ]);
    const warningParsed = JSON.parse(warningOnly.stdout);

    await fs.writeFile(
      path.join(root, "problems/2/problem.json"),
      `${JSON.stringify(problemEntry({
        id: 2,
        description: '<img src="new-missing.png">',
      }), null, 2)}\n`,
    );
    const newError = await execNode([
      cliPath,
      "--root",
      root,
      "--compare-baseline",
      baselinePath,
      "--json",
    ]);
    const newErrorParsed = JSON.parse(newError.stdout);

    expect(warningOnly.stderr).toBe("");
    expect(warningOnly.exitCode).toBe(0);
    expect(warningParsed.baselineCompare.counts.newIssues.bySeverity.warning).toBe(1);
    expect(newError.stderr).toBe("");
    expect(newError.exitCode).toBe(1);
    expect(newErrorParsed.baselineCompare.counts.newIssues.bySeverity.error).toBe(1);
  });

  it("--compare-baseline reports missing, invalid, wrong-kind/version, and malformed baselines as JSON failures", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({ id: 1 }),
      },
    });
    const cases = [
      ["missing", path.join(root, "missing-baseline.json"), null],
      ["invalid-json", path.join(root, "invalid-baseline.json"), "{"],
      ["wrong-kind", path.join(root, "wrong-kind.json"), JSON.stringify({
        kind: "not-archive-quality",
        version: 1,
        issues: [],
      })],
      ["wrong-version", path.join(root, "wrong-version.json"), JSON.stringify({
        kind: "boj-archive-quality-baseline",
        version: 999,
        issues: [],
      })],
      ["malformed-issue", path.join(root, "malformed-issue.json"), JSON.stringify({
        kind: "boj-archive-quality-baseline",
        version: 1,
        issues: [{ severity: "error", type: "missing-image" }],
      })],
    ];

    for (const [, baselinePath, content] of cases) {
      if (content != null) await fs.writeFile(baselinePath, content);
      const { stdout, stderr, exitCode } = await execNode([
        cliPath,
        "--root",
        root,
        "--compare-baseline",
        baselinePath,
        "--json",
      ]);
      const parsed = JSON.parse(stdout);

      expect(stderr).toBe("");
      expect(exitCode).toBe(1);
      expect(parsed.issues[0].type).toBe("baseline-error");
    }
  });

  it("--risk-report appears in JSON only when requested", async () => {
    const root = await createArchive({
      index: [indexEntry({ id: 1 })],
      problems: {
        1: problemEntry({
          id: 1,
          description: "<script>alert(1)</script>",
        }),
      },
    });

    const plain = await execNode([cliPath, "--root", root, "--json"]);
    const withRisk = await execNode([cliPath, "--root", root, "--risk-report", "--json"]);
    const plainParsed = JSON.parse(plain.stdout);
    const riskParsed = JSON.parse(withRisk.stdout);

    expect(plainParsed.riskReport).toBeUndefined();
    expect(riskParsed.riskReport.topProblems[0]).toMatchObject({
      id: 1,
      score: 50,
    });
  });

  it("human output includes summary headings and capped examples", async () => {
    const problems = {};
    const index = [];
    for (let id = 1; id <= 25; id += 1) {
      index.push(indexEntry({ id }));
      problems[id] = problemEntry({ id, description: `<img src="missing-${id}.png">` });
    }
    const root = await createArchive({ index, problems });

    const { stdout, exitCode } = await execNode([cliPath, "--root", root]);

    expect(exitCode).toBe(1);
    expect(stdout).toContain("Archive Quality Scanner");
    expect(stdout).toContain("Error Examples");
    expect(stdout).toContain("... 5 more");
    expect(stdout).toContain("Full details: run with --json");
  });

  it("importing the CLI module has no execution side effects", async () => {
    const moduleUrl = pathToFileURL(cliPath).href;
    const { stdout, stderr, exitCode } = await execNode([
      "--input-type=module",
      "-e",
      `import(${JSON.stringify(moduleUrl)}).then(() => console.log("imported"))`,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toBe("imported\n");
  });
});

async function execNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      maxBuffer: 1024 * 1024 * 20,
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout,
      stderr: error.stderr,
      exitCode: error.code,
    };
  }
}

async function createArchive({ index, rawIndex, problems = {}, files = {} }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "archive-quality-"));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, "problems"), { recursive: true });

  await fs.writeFile(
    path.join(root, "index.json"),
    rawIndex ?? `${JSON.stringify(index ?? [], null, 2)}\n`,
  );

  for (const [id, problem] of Object.entries(problems)) {
    const problemDir = path.join(root, "problems", id);
    await fs.mkdir(problemDir, { recursive: true });
    const text = typeof problem === "string" ? problem : `${JSON.stringify(problem, null, 2)}\n`;
    await fs.writeFile(path.join(problemDir, "problem.json"), text);
  }

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  return root;
}

function indexEntry(overrides = {}) {
  return {
    id: 1,
    title: "Sample",
    time_limit: "1 초",
    memory_limit: "128 MB",
    level: 1,
    tags: ["implementation"],
    accepted_user_count: 10,
    average_tries: 1.5,
    ...overrides,
  };
}

function problemEntry(overrides = {}) {
  return {
    id: 1,
    title: "Sample",
    time_limit: "1 초",
    memory_limit: "128 MB",
    description: "<p>description</p>",
    input: "<p>input</p>",
    output: "<p>output</p>",
    samples: [{ input: "1\n", output: "1\n" }],
    hint: null,
    source: "baekjoon",
    level: 1,
    tags: ["implementation"],
    accepted_user_count: 10,
    submission_count: null,
    average_tries: 1.5,
    ...overrides,
  };
}
