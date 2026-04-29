#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const HTML_FIELDS = ["description", "input", "output", "hint"];
export const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
]);

const VERSION = 1;
const BASELINE_VERSION = 1;
const BASELINE_KIND = "boj-archive-quality-baseline";
const DEFAULT_TOP = 10;
const ISSUE_PREVIEW_LIMIT = 20;
const LARGE_PROBLEM_JSON_THRESHOLDS = [
  [512 * 1024, 30],
  [256 * 1024, 20],
  [128 * 1024, 10],
  [64 * 1024, 5],
];
const RISK_WEIGHTS = {
  "missing-image": 30,
  "image-path-traversal": 35,
  "script-tag": 50,
  "iframe-tag": 45,
  "object-tag": 45,
  "embed-tag": 45,
  "inline-event-handler": 25,
  "javascript-url": 40,
  "style-tag": 10,
};
const METADATA_FIELDS = [
  "id",
  "title",
  "time_limit",
  "memory_limit",
  "level",
  "tags",
  "accepted_user_count",
  "average_tries",
];
const FIELD_ORDER = new Map(HTML_FIELDS.map((field, index) => [field, index]));
const SEVERITY_ORDER = new Map([
  ["error", 0],
  ["warning", 1],
  ["info", 2],
]);

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    root: ".",
    json: false,
    top: DEFAULT_TOP,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--root") {
      const value = argv[++i];
      if (!value) throw argumentError("--root requires a path");
      options.root = value;
    } else if (arg === "--top") {
      const value = argv[++i];
      if (!value) throw argumentError("--top requires a number");
      const top = Number(value);
      if (!Number.isInteger(top) || top <= 0) {
        throw argumentError("--top requires a positive integer");
      }
      options.top = top;
    } else if (arg === "--write-baseline") {
      const value = argv[++i];
      if (!value) throw argumentError("--write-baseline requires a path");
      options.writeBaseline = value;
    } else if (arg === "--compare-baseline") {
      const value = argv[++i];
      if (!value) throw argumentError("--compare-baseline requires a path");
      options.compareBaseline = value;
    } else if (arg === "--risk-report") {
      options.riskReport = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw argumentError(`unknown option: ${arg}`);
    }
  }

  return options;
}

function argumentError(message) {
  const error = new Error(message);
  error.code = "ARGUMENT_ERROR";
  return error;
}

function baselineError(message) {
  const error = new Error(message);
  error.code = "BASELINE_ERROR";
  return error;
}

export async function scanArchive(options = {}) {
  const resolvedOptions = {
    root: options.root ?? ".",
    json: Boolean(options.json),
    top: options.top ?? DEFAULT_TOP,
  };
  const root = path.resolve(resolvedOptions.root);
  const result = createEmptyResult(root, resolvedOptions);
  const problemsDir = path.join(root, "problems");

  let rootStat;
  try {
    rootStat = await fs.stat(root);
  } catch {
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "invalid-root",
      path: root,
      message: `root path does not exist: ${root}`,
    });
    return finalizeResult(result);
  }

  if (!rootStat.isDirectory()) {
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "invalid-root",
      path: root,
      message: `root path is not a directory: ${root}`,
    });
    return finalizeResult(result);
  }

  let problemDirs = [];
  let hasProblemsDir = true;
  try {
    problemDirs = await listProblemDirectories(problemsDir);
    result.summary.problemDirectoryCount = problemDirs.length;
    result.summary.imageFileCount = await countImageFiles(problemsDir);
  } catch (error) {
    hasProblemsDir = false;
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "missing-problems-dir",
      path: relativePath(root, problemsDir),
      message: `problems directory is missing or unreadable: ${error.message}`,
    });
  }

  const indexPath = path.join(root, "index.json");
  let index;
  try {
    const indexText = await fs.readFile(indexPath, "utf8");
    index = JSON.parse(indexText);
  } catch (error) {
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: error.code === "ENOENT" ? "missing-index-json" : "invalid-index-json",
      path: "index.json",
      message: error.code === "ENOENT"
        ? "index.json is missing"
        : `index.json is not valid JSON: ${error.message}`,
    });
    return finalizeResult(result);
  }

  if (!Array.isArray(index)) {
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "invalid-index-json",
      path: "index.json",
      message: "index.json must contain an array",
    });
    return finalizeResult(result);
  }

  result.summary.indexProblemCount = index.length;

  if (!hasProblemsDir) {
    return finalizeResult(result);
  }

  const { indexById, indexIds } = buildIndexMap(index, result);
  const problemDirIds = problemDirs.map((dir) => dir.name);
  const problemDirIdSet = new Set(problemDirIds);
  const allIds = sortIds([...new Set([...indexIds, ...problemDirIds])]);

  for (const id of sortIds(indexIds)) {
    if (!problemDirIdSet.has(id)) {
      addIssue(result, {
        severity: "error",
        category: "integrity",
        type: "missing-problem-json",
        id: idAsNumber(id),
        path: `problems/${id}/problem.json`,
        message: `index contains ${id} but problem.json is missing`,
      });
    }
  }

  for (const id of sortIds(problemDirIds)) {
    if (!indexById.has(id)) {
      addIssue(result, {
        severity: "error",
        category: "integrity",
        type: "orphan-problem-dir",
        id: idAsNumber(id),
        path: `problems/${id}`,
        message: `problem directory ${id} is not present in index.json`,
      });
    }
  }

  for (const id of allIds) {
    if (!problemDirIdSet.has(id)) continue;
    await scanProblemJson({
      id,
      root,
      problemsDir,
      indexEntry: indexById.get(id),
      result,
    });
  }

  return finalizeResult(result);
}

async function scanProblemJson({ id, root, problemsDir, indexEntry, result }) {
  const problemDir = path.join(problemsDir, id);
  const problemPath = path.join(problemDir, "problem.json");
  let text;
  let stat;

  try {
    stat = await fs.stat(problemPath);
    if (!stat.isFile()) throw new Error("problem.json is not a file");
    text = await fs.readFile(problemPath, "utf8");
  } catch (error) {
    if (indexEntry) {
      addIssue(result, {
        severity: "error",
        category: "integrity",
        type: "missing-problem-json",
        id: idAsNumber(id),
        path: `problems/${id}/problem.json`,
        message: `problem.json is missing or unreadable: ${error.message}`,
      });
    }
    return;
  }

  result.summary.problemJsonCount += 1;
  result.summary.largestProblemJson.push({
    id: idAsNumber(id),
    bytes: stat.size,
    path: `problems/${id}/problem.json`,
  });
  if (largeProblemJsonScore(stat.size) > 0) {
    result.summary.largeProblemJson.push({
      id: idAsNumber(id),
      bytes: stat.size,
      path: `problems/${id}/problem.json`,
    });
  }

  let problem;
  try {
    problem = JSON.parse(text);
  } catch (error) {
    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "invalid-problem-json",
      id: idAsNumber(id),
      path: `problems/${id}/problem.json`,
      message: `problem.json is not valid JSON: ${error.message}`,
    });
    return;
  }

  if (indexEntry) {
    compareMetadata(indexEntry, problem, id, result);
  }

  collectProblemStats(problem, result);

  for (const field of HTML_FIELDS) {
    const html = htmlField(problem[field]);
    await scanImages({
      html,
      id,
      field,
      root,
      problemDir,
      result,
    });
    scanRiskyHtml({
      html,
      id,
      field,
      result,
    });
  }
}

function collectProblemStats(problem, result) {
  if (!Array.isArray(problem.samples) || problem.samples.length === 0) {
    result.summary.samplesMissingCount += 1;
  }
  if (problem.hint != null && String(problem.hint).trim() !== "") {
    result.summary.hintPresentCount += 1;
  }
  if (!Array.isArray(problem.tags) || problem.tags.length === 0) {
    result.summary.tagsMissingCount += 1;
  }
  if (problem.level == null) {
    result.summary.levelCounts.null += 1;
  } else if (Number(problem.level) === 0) {
    result.summary.levelCounts.zero += 1;
  } else {
    result.summary.levelCounts.nonZero += 1;
  }
}

function compareMetadata(indexEntry, problem, fallbackId, result) {
  for (const field of METADATA_FIELDS) {
    const indexValue = metadataCompareValue(field, indexEntry[field]);
    const problemValue = metadataCompareValue(field, problem[field]);
    if (stableStringify(indexValue) === stableStringify(problemValue)) continue;

    addIssue(result, {
      severity: "error",
      category: "integrity",
      type: "metadata-mismatch",
      id: idAsNumber(String(indexEntry.id ?? problem.id ?? fallbackId)),
      field,
      path: `problems/${fallbackId}/problem.json`,
      message: `metadata mismatch for ${fallbackId}.${field}`,
      indexValue: summarizeValue(indexValue),
      problemValue: summarizeValue(problemValue),
    });
  }
}

function metadataCompareValue(field, value) {
  if (field === "id") return value == null ? value : String(value);
  if (field === "tags") return normalizeTags(value);
  return value;
}

export function normalizeTags(value) {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) => normalizeTagItem(item))
    .sort(compareTagItems);
}

function normalizeTagItem(item) {
  if (item == null) return item;
  if (typeof item !== "object") return String(item);
  return sortObjectKeys(item);
}

function compareTagItems(a, b) {
  return compareStrings(tagSortKey(a), tagSortKey(b));
}

function tagSortKey(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    for (const key of ["id", "key", "name", "display_name"]) {
      if (Object.hasOwn(item, key)) return `${key}:${String(item[key])}`;
    }
  }
  return stableStringify(item);
}

async function scanImages({ html, id, field, root, problemDir, result }) {
  const refs = extractImageRefs(html);
  for (const ref of refs) {
    result.imageRefs.total += 1;
    result.imageRefs.byField[field] += 1;

    const src = ref.src.trim();
    const classification = classifySrc(src);
    if (classification === "external") {
      result.imageRefs.external += 1;
      continue;
    }
    if (classification === "absoluteOrScheme") {
      result.imageRefs.absoluteOrScheme += 1;
      continue;
    }

    result.imageRefs.relative += 1;
    const localPath = stripQueryAndHash(src);
    const resolvedPath = path.resolve(problemDir, localPath);
    const relToProblemDir = path.relative(problemDir, resolvedPath);
    const escaped = relToProblemDir === ".."
      || relToProblemDir.startsWith(`..${path.sep}`)
      || path.isAbsolute(relToProblemDir);
    if (escaped) {
      addIssue(result, {
        severity: "error",
        category: "image",
        type: "image-path-traversal",
        id: idAsNumber(id),
        field,
        path: relativePath(root, resolvedPath),
        message: `image src escapes problem directory: ${src}`,
        src,
      });
      continue;
    }

    if (!(await fileExists(resolvedPath))) {
      result.imageRefs.missing += 1;
      addIssue(result, {
        severity: "error",
        category: "image",
        type: "missing-image",
        id: idAsNumber(id),
        field,
        path: relativePath(root, resolvedPath),
        message: `image referenced by ${id}.${field} is missing: ${src}`,
        src,
      });
    }
  }
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function extractImageRefs(html) {
  const refs = [];
  for (const match of html.matchAll(/<\s*img\b[\s\S]*?>/gi)) {
    const tag = match[0];
    const attrMatch = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
    if (!attrMatch) continue;
    const rawSrc = attrMatch[1] ?? attrMatch[2] ?? attrMatch[3] ?? "";
    refs.push({
      src: decodeHtmlEntities(rawSrc),
      rawSrc,
      tag,
      index: match.index,
    });
  }
  return refs;
}

function classifySrc(src) {
  if (/^https?:\/\//i.test(src) || /^\/\//.test(src)) return "external";
  if (src.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(src)) return "absoluteOrScheme";
  return "relative";
}

function stripQueryAndHash(src) {
  const queryIndex = src.search(/[?#]/);
  return queryIndex === -1 ? src : src.slice(0, queryIndex);
}

function scanRiskyHtml({ html, id, field, result }) {
  const patterns = [
    ["script-tag", /<\s*script\b[\s\S]*?>/gi],
    ["style-tag", /<\s*style\b[\s\S]*?>/gi],
    ["iframe-tag", /<\s*iframe\b[\s\S]*?>/gi],
    ["object-tag", /<\s*object\b[\s\S]*?>/gi],
    ["embed-tag", /<\s*embed\b[\s\S]*?>/gi],
  ];

  for (const [type, pattern] of patterns) {
    for (const match of html.matchAll(pattern)) {
      addRiskyHtml(result, {
        type,
        id,
        field,
        snippet: snippet(match[0]),
      });
    }
  }

  for (const tagMatch of html.matchAll(/<[^>]+>/g)) {
    const tag = tagMatch[0];
    for (const match of tag.matchAll(/\s(on[a-z][\w:-]*)\s*=/gi)) {
      addRiskyHtml(result, {
        type: "inline-event-handler",
        id,
        field,
        snippet: snippet(tag),
        detail: match[1].toLowerCase(),
      });
    }

    for (const match of tag.matchAll(/\b[\w:-]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
      const value = decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "")
        .trimStart()
        .toLowerCase();
      if (!value.startsWith("javascript:")) continue;
      addRiskyHtml(result, {
        type: "javascript-url",
        id,
        field,
        snippet: snippet(tag),
      });
    }
  }
}

function addRiskyHtml(result, { type, id, field, snippet: htmlSnippet, detail }) {
  result.riskyHtml.push({
    severity: "warning",
    category: "html",
    type,
    id: idAsNumber(id),
    field,
    snippet: htmlSnippet,
    ...(detail ? { detail } : {}),
  });
}

export function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    quot: "\"",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };

  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return Object.hasOwn(named, lower) ? named[lower] : match;
  });
}

async function listProblemDirectories(problemsDir) {
  const entries = await fs.readdir(problemsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => ({ name: entry.name }))
    .sort((a, b) => compareIds(a.name, b.name));
}

async function countImageFiles(dir) {
  let count = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        count += 1;
      }
    }
  }
  return count;
}

function buildIndexMap(index, result) {
  const indexById = new Map();
  const indexIds = [];
  const seen = new Map();

  for (let position = 0; position < index.length; position += 1) {
    const entry = index[position];
    const id = String(entry?.id);
    if (seen.has(id)) {
      addIssue(result, {
        severity: "error",
        category: "integrity",
        type: "duplicate-index-id",
        id: idAsNumber(id),
        path: "index.json",
        message: `duplicate id ${id} in index.json`,
        firstIndex: seen.get(id),
        duplicateIndex: position,
      });
      continue;
    }
    seen.set(id, position);
    indexIds.push(id);
    indexById.set(id, entry);
  }

  return { indexById, indexIds };
}

function addIssue(result, issue) {
  result.issues.push({
    field: null,
    ...issue,
  });
}

function createEmptyResult(root, options) {
  return {
    version: VERSION,
    root,
    generatedAt: new Date().toISOString(),
    options: {
      top: options.top ?? DEFAULT_TOP,
      json: Boolean(options.json),
    },
    summary: {
      indexProblemCount: 0,
      problemDirectoryCount: 0,
      problemJsonCount: 0,
      imageFileCount: 0,
      samplesMissingCount: 0,
      hintPresentCount: 0,
      tagsMissingCount: 0,
      levelCounts: {
        null: 0,
        zero: 0,
        nonZero: 0,
      },
      largestProblemJson: [],
      largeProblemJson: [],
    },
    imageRefs: {
      total: 0,
      relative: 0,
      missing: 0,
      external: 0,
      absoluteOrScheme: 0,
      byField: {
        description: 0,
        input: 0,
        output: 0,
        hint: 0,
      },
    },
    issues: [],
    riskyHtml: [],
    exitCode: 0,
  };
}

export function createFailureResult({
  root = process.cwd(),
  options = {},
  type = "internal-error",
  category = "cli",
  message = "unexpected error",
} = {}) {
  const result = createEmptyResult(path.resolve(root), {
    top: options.top ?? DEFAULT_TOP,
    json: Boolean(options.json),
  });
  addIssue(result, {
    severity: "error",
    category,
    type,
    path: null,
    message,
  });
  return finalizeResult(result);
}

function finalizeResult(result) {
  result.summary.largestProblemJson = sortLargestProblemJson(result.summary.largestProblemJson)
    .slice(0, result.options.top);
  result.summary.largeProblemJson = sortLargestProblemJson(result.summary.largeProblemJson);
  result.issues.sort(compareIssues);
  result.riskyHtml.sort(compareRiskyHtml);
  result.exitCode = result.issues.some((issue) => issue.severity === "error") ? 1 : 0;
  return result;
}

function sortLargestProblemJson(entries) {
  return entries.sort((a, b) => {
    if (b.bytes !== a.bytes) return b.bytes - a.bytes;
    return compareIds(a.id, b.id);
  });
}

function compareIssues(a, b) {
  return compareNumbers(SEVERITY_ORDER.get(a.severity) ?? 99, SEVERITY_ORDER.get(b.severity) ?? 99)
    || compareStrings(a.category, b.category)
    || compareStrings(a.type, b.type)
    || compareIds(a.id, b.id)
    || compareField(a.field, b.field)
    || compareStrings(a.path, b.path)
    || compareStrings(a.message, b.message);
}

function compareRiskyHtml(a, b) {
  return compareIds(a.id, b.id)
    || compareField(a.field, b.field)
    || compareStrings(a.type, b.type)
    || compareStrings(a.snippet, b.snippet);
}

function compareField(a, b) {
  const aOrder = FIELD_ORDER.has(a) ? FIELD_ORDER.get(a) : 99;
  const bOrder = FIELD_ORDER.has(b) ? FIELD_ORDER.get(b) : 99;
  return compareNumbers(aOrder, bOrder) || compareStrings(a, b);
}

function compareIds(a, b) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  const aFinite = Number.isFinite(aNumber);
  const bFinite = Number.isFinite(bNumber);
  if (aFinite && bFinite && aNumber !== bNumber) return aNumber - bNumber;
  return compareStrings(a, b);
}

function sortIds(ids) {
  return [...ids].sort(compareIds);
}

function compareNumbers(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

function compareStrings(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function idAsNumber(id) {
  const number = Number(id);
  return Number.isFinite(number) ? number : id;
}

function htmlField(value) {
  return value == null ? "" : String(value);
}

function relativePath(root, targetPath) {
  const relative = path.relative(root, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative
    : targetPath;
}

function summarizeValue(value) {
  if (typeof value === "string") return truncate(value, 160);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  const stable = stableStringify(value);
  return truncate(stable, 240);
}

function stableStringify(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map((item) => sortObjectKeys(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObjectKeys(value[key])]),
  );
}

function snippet(value) {
  return truncate(String(value).replace(/\s+/g, " ").trim(), 200);
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

export function normalizeComparablePath(value, root) {
  if (value == null || value === "") return null;
  let normalized = normalizePathSeparators(String(value).trim());
  const normalizedRoot = root ? normalizePathSeparators(String(root)).replace(/\/+$/, "") : "";

  if (normalizedRoot) {
    if (normalized === normalizedRoot) {
      normalized = ".";
    } else if (normalized.startsWith(`${normalizedRoot}/`)) {
      normalized = normalized.slice(normalizedRoot.length + 1);
    }
  }

  return normalized.replace(/^\.\//, "");
}

function normalizePathSeparators(value) {
  return String(value).replace(/\\/g, "/").replace(/\/+/g, "/");
}

function normalizeSourceValue(value) {
  if (value == null || value === "") return null;
  return decodeHtmlEntities(String(value)).trim().replace(/\\/g, "/");
}

function sanitizeBaselineMessage(value, root) {
  if (value == null) return null;
  let message = String(value);
  if (!root) return message;

  const rawRoot = String(root);
  const normalizedRoot = normalizePathSeparators(rawRoot);
  message = message.split(rawRoot).join("<root>");
  if (normalizedRoot !== rawRoot) {
    message = message.split(normalizedRoot).join("<root>");
  }
  return message;
}

function normalizeIssueIdentity(issue, options = {}) {
  const severity = String(issue.severity ?? "warning").toLowerCase();
  const category = String(issue.category ?? "unknown").toLowerCase();
  const type = String(issue.type ?? "unknown").toLowerCase();
  const field = issue.field == null ? null : String(issue.field).toLowerCase();
  const normalizedPath = normalizeComparablePath(issue.path, options.root);

  let source = null;
  if (issue.src != null) {
    source = `src:${normalizeSourceValue(issue.src)}`;
  } else if (issue.source != null) {
    source = `source:${normalizeSourceValue(issue.source)}`;
  } else if (issue.detail != null) {
    source = `detail:${String(issue.detail).toLowerCase()}`;
  } else if (type === "metadata-mismatch") {
    source = `values:${valueKind(issue.indexValue)}->${valueKind(issue.problemValue)}`;
  }

  return {
    severity,
    category,
    type,
    id: issue.id == null ? null : String(issue.id),
    field,
    path: normalizedPath,
    source,
  };
}

function valueKind(value) {
  if (value == null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function createIssueFingerprint(issue, options = {}) {
  const identity = normalizeIssueIdentity(issue, options);
  const fingerprint = identityToFingerprint(identity);
  return {
    fingerprint,
    hash: hashFingerprint(fingerprint),
  };
}

function identityToFingerprint(identity) {
  return [
    ["severity", identity.severity],
    ["category", identity.category],
    ["type", identity.type],
    ["id", identity.id],
    ["field", identity.field],
    ["path", identity.path],
    ["source", identity.source],
  ]
    .map(([key, value]) => `${key}:${fingerprintPart(value)}`)
    .join("|");
}

function fingerprintPart(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|");
}

function hashFingerprint(fingerprint) {
  return `sha256:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 12)}`;
}

export function normalizeFindings(result, options = {}) {
  const root = options.root ?? result.root;
  const rawFindings = [
    ...(result.issues ?? []),
    ...(result.riskyHtml ?? []).map((issue) => ({
      severity: "warning",
      category: "html",
      message: issue.snippet,
      ...issue,
    })),
  ].map((issue) => normalizeFinding(issue, { root }));

  rawFindings.sort((a, b) => compareStrings(a.fingerprint, b.fingerprint)
    || compareStrings(a.message, b.message));

  const occurrences = new Map();
  return rawFindings.map((issue) => {
    const occurrence = (occurrences.get(issue.fingerprint) ?? 0) + 1;
    occurrences.set(issue.fingerprint, occurrence);
    if (occurrence === 1) return issue;

    const fingerprint = `${issue.fingerprint}|occurrence:${occurrence}`;
    return {
      ...issue,
      fingerprint,
      hash: hashFingerprint(fingerprint),
    };
  });
}

function normalizeFinding(issue, options) {
  const identity = normalizeIssueIdentity(issue, options);
  const { fingerprint, hash } = createIssueFingerprint(issue, options);
  const normalized = {
    fingerprint,
    hash,
    severity: identity.severity,
    category: identity.category,
    type: identity.type,
  };

  if (identity.id != null) normalized.id = idAsNumber(identity.id);
  if (identity.field != null) normalized.field = identity.field;
  if (identity.path != null) normalized.path = identity.path;
  if (identity.source != null) normalized.source = identity.source;
  if (issue.message != null) normalized.message = sanitizeBaselineMessage(issue.message, options.root);
  return normalized;
}

export function createBaseline(result, options = {}) {
  const issues = normalizeFindings(result, { root: result.root });
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    kind: BASELINE_KIND,
    version: BASELINE_VERSION,
    scannerVersion: VERSION,
    createdFrom: {
      root: ".",
      options: {
        top: options.top ?? result.options?.top ?? DEFAULT_TOP,
      },
    },
    summary: {
      issueCount: issues.length,
      errorCount,
      warningCount,
      stats: {
        summary: result.summary,
        imageRefs: result.imageRefs,
      },
      bySeverity: countBy(issues, "severity"),
      byType: countBy(issues, "type"),
    },
    issues,
  };
}

export function stableJson(value) {
  return `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
}

export async function writeBaselineFile(filePath, baseline) {
  await fs.writeFile(filePath, stableJson(baseline), "utf8");
}

export async function readBaselineFile(filePath) {
  let text;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw baselineError(`baseline file is missing or unreadable: ${error.message}`);
  }

  let baseline;
  try {
    baseline = JSON.parse(text);
  } catch (error) {
    throw baselineError(`baseline file is not valid JSON: ${error.message}`);
  }

  validateBaseline(baseline);
  return baseline;
}

function validateBaseline(baseline) {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    throw baselineError("baseline must be a JSON object");
  }
  if (baseline.kind !== BASELINE_KIND) {
    throw baselineError(`baseline kind must be ${BASELINE_KIND}`);
  }
  if (baseline.version !== BASELINE_VERSION) {
    throw baselineError(`baseline version must be ${BASELINE_VERSION}`);
  }
  if (!Array.isArray(baseline.issues)) {
    throw baselineError("baseline issues must be an array");
  }

  for (const [index, issue] of baseline.issues.entries()) {
    if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
      throw baselineError(`baseline issue ${index} must be an object`);
    }
    if (typeof issue.fingerprint !== "string" || issue.fingerprint.length === 0) {
      throw baselineError(`baseline issue ${index} must include a fingerprint`);
    }
    if (typeof issue.severity !== "string" || typeof issue.type !== "string") {
      throw baselineError(`baseline issue ${index} must include severity and type`);
    }
  }
}

export function compareBaseline(result, baseline) {
  const currentIssues = normalizeFindings(result, { root: result.root });
  const currentByFingerprint = mapIssuesByFingerprint(currentIssues);
  const baselineByFingerprint = mapIssuesByFingerprint(baseline.issues);

  const newIssues = currentIssues.filter((issue) => !baselineByFingerprint.has(issue.fingerprint));
  const resolvedIssues = baseline.issues.filter((issue) => !currentByFingerprint.has(issue.fingerprint));
  const unchangedIssues = currentIssues.filter((issue) => baselineByFingerprint.has(issue.fingerprint));
  const exitCode = newIssues.some((issue) => issue.severity === "error") ? 1 : 0;

  return {
    newIssues,
    resolvedIssues,
    unchangedIssues,
    counts: {
      newIssues: issueSummary(newIssues),
      resolvedIssues: issueSummary(resolvedIssues),
      unchangedIssues: issueSummary(unchangedIssues),
    },
    exitCode,
  };
}

function mapIssuesByFingerprint(issues) {
  return new Map(issues.map((issue) => [issue.fingerprint, issue]));
}

function issueSummary(issues) {
  return {
    total: issues.length,
    bySeverity: countBy(issues, "severity"),
    byType: countBy(issues, "type"),
  };
}

export function calculateRiskReport(result, options = {}) {
  const top = options.top ?? result.options?.top ?? DEFAULT_TOP;
  const byProblem = new Map();
  const byReason = new Map();

  for (const issue of result.issues ?? []) {
    if (!Object.hasOwn(RISK_WEIGHTS, issue.type) || issue.id == null) continue;
    addRiskReason({
      byProblem,
      byReason,
      id: issue.id,
      path: issue.path ?? `problems/${issue.id}/problem.json`,
      type: issue.type,
      score: RISK_WEIGHTS[issue.type],
    });
  }

  for (const issue of result.riskyHtml ?? []) {
    if (!Object.hasOwn(RISK_WEIGHTS, issue.type) || issue.id == null) continue;
    addRiskReason({
      byProblem,
      byReason,
      id: issue.id,
      path: `problems/${issue.id}/problem.json`,
      type: issue.type,
      score: RISK_WEIGHTS[issue.type],
    });
  }

  for (const entry of result.summary.largeProblemJson ?? result.summary.largestProblemJson ?? []) {
    const score = largeProblemJsonScore(entry.bytes);
    if (score === 0) continue;
    addRiskReason({
      byProblem,
      byReason,
      id: entry.id,
      path: entry.path,
      type: "very-large-problem-json",
      score,
      bytes: entry.bytes,
    });
  }

  const problems = [...byProblem.values()]
    .map((problem) => ({
      ...problem,
      reasons: [...problem.reasons.values()]
        .sort((a, b) => compareStrings(a.type, b.type)),
    }))
    .sort((a, b) => compareNumbers(b.score, a.score) || compareIds(a.id, b.id));

  return {
    topProblems: problems.slice(0, top),
    problemCount: problems.length,
    byReason: Object.fromEntries(
      [...byReason.entries()]
        .sort(([a], [b]) => compareStrings(a, b))
        .map(([type, value]) => [type, value]),
    ),
  };
}

function addRiskReason({ byProblem, byReason, id, path: issuePath, type, score, bytes }) {
  const key = String(id);
  if (!byProblem.has(key)) {
    byProblem.set(key, {
      id: idAsNumber(id),
      path: issuePath ?? `problems/${id}/problem.json`,
      score: 0,
      reasons: new Map(),
    });
  }

  const problem = byProblem.get(key);
  problem.score += score;
  const reason = problem.reasons.get(type) ?? {
    type,
    count: 0,
    score: 0,
    ...(bytes == null ? {} : { bytes }),
  };
  reason.count += 1;
  reason.score += score;
  if (bytes != null) reason.bytes = bytes;
  problem.reasons.set(type, reason);

  const aggregate = byReason.get(type) ?? { count: 0, score: 0 };
  aggregate.count += 1;
  aggregate.score += score;
  byReason.set(type, aggregate);
}

function largeProblemJsonScore(bytes) {
  for (const [threshold, score] of LARGE_PROBLEM_JSON_THRESHOLDS) {
    if (bytes >= threshold) return score;
  }
  return 0;
}

export function formatHumanReport(result) {
  const errors = result.issues.filter((issue) => issue.severity === "error");
  const warnings = result.riskyHtml;
  const riskCounts = countBy(result.riskyHtml, "type");
  const issueCounts = countBy(result.issues, "type");

  const lines = [
    "Archive Quality Scanner",
    "",
    `Root: ${result.root}`,
    `Problems in index: ${result.summary.indexProblemCount}`,
    `Problem directories: ${result.summary.problemDirectoryCount}`,
    `Problem JSON files: ${result.summary.problemJsonCount}`,
    `Image files: ${result.summary.imageFileCount}`,
    "",
    "Integrity",
    `  errors: ${errors.length}`,
  ];

  for (const [type, count] of Object.entries(issueCounts).sort(([a], [b]) => compareStrings(a, b))) {
    lines.push(`  ${type}: ${count}`);
  }

  lines.push(
    "",
    "Images",
    `  refs: ${result.imageRefs.total}`,
    `  relative: ${result.imageRefs.relative}`,
    `  missing: ${result.imageRefs.missing}`,
    `  external: ${result.imageRefs.external}`,
    `  absolute/scheme: ${result.imageRefs.absoluteOrScheme}`,
    "",
    "Risky HTML",
    `  warnings: ${warnings.length}`,
  );

  for (const [type, count] of Object.entries(riskCounts).sort(([a], [b]) => compareStrings(a, b))) {
    lines.push(`  ${type}: ${count}`);
  }

  appendBaselineReport(lines, result);
  appendRiskReport(lines, result);

  lines.push(
    "",
    "Data Quality",
    `  no samples: ${result.summary.samplesMissingCount}`,
    `  has hint: ${result.summary.hintPresentCount}`,
    `  no tags: ${result.summary.tagsMissingCount}`,
    `  level null: ${result.summary.levelCounts.null}`,
    `  level 0: ${result.summary.levelCounts.zero}`,
    `  level non-zero: ${result.summary.levelCounts.nonZero}`,
    "",
    "Largest problem.json",
  );

  if (result.summary.largestProblemJson.length === 0) {
    lines.push("  none");
  } else {
    for (const entry of result.summary.largestProblemJson) {
      lines.push(`  ${entry.id}  ${entry.bytes} bytes  ${entry.path}`);
    }
  }

  appendExamples(lines, "Error Examples", errors, formatIssueExample);
  appendExamples(lines, "Warning Examples", warnings, formatRiskExample);

  if (errors.length > ISSUE_PREVIEW_LIMIT || warnings.length > ISSUE_PREVIEW_LIMIT) {
    lines.push("", "Full details: run with --json");
  }

  lines.push("", `Exit code: ${result.exitCode}`);
  return `${lines.join("\n")}\n`;
}

function appendBaselineReport(lines, result) {
  if (!result.baselineWrite && !result.baselineCompare) return;

  lines.push("", "Baseline");
  if (result.baselineWrite) {
    const write = result.baselineWrite;
    lines.push(`  write: ${write.status} ${write.path}`);
    if (write.status === "written") {
      lines.push(`  issues: ${write.issueCount} (${write.errorCount} errors, ${write.warningCount} warnings)`);
      if (write.errorCount > 0) {
        lines.push(`  scan still has ${write.errorCount} error(s); preserving scan exit code ${result.exitCode}`);
      }
    } else if (write.message) {
      lines.push(`  message: ${write.message}`);
    }
  }

  if (result.baselineCompare) {
    const compare = result.baselineCompare;
    lines.push(`  new: ${compare.counts.newIssues.total}`);
    lines.push(`  resolved: ${compare.counts.resolvedIssues.total}`);
    lines.push(`  unchanged: ${compare.counts.unchangedIssues.total}`);
    lines.push(`  new errors: ${compare.counts.newIssues.bySeverity.error ?? 0}`);
    lines.push(`  new warnings: ${compare.counts.newIssues.bySeverity.warning ?? 0}`);
  }
}

function appendRiskReport(lines, result) {
  if (!result.riskReport) return;

  lines.push("", "Heuristic Archive Risk");
  if (result.riskReport.topProblems.length === 0) {
    lines.push("  none");
    return;
  }

  for (const problem of result.riskReport.topProblems) {
    const reasons = problem.reasons
      .map((reason) => `${reason.type} x${reason.count}`)
      .join(", ");
    lines.push(`  ${problem.id}  score ${problem.score}  ${reasons}`);
  }
}

function appendExamples(lines, title, entries, formatter) {
  lines.push("", title);
  if (entries.length === 0) {
    lines.push("  none");
    return;
  }
  for (const entry of entries.slice(0, ISSUE_PREVIEW_LIMIT)) {
    lines.push(`  - ${formatter(entry)}`);
  }
  if (entries.length > ISSUE_PREVIEW_LIMIT) {
    lines.push(`  ... ${entries.length - ISSUE_PREVIEW_LIMIT} more`);
  }
}

function formatIssueExample(issue) {
  const id = issue.id == null ? "-" : issue.id;
  const field = issue.field ? ` ${issue.field}` : "";
  return `[${issue.type}] ${id}${field}: ${issue.message}`;
}

function formatRiskExample(issue) {
  return `[${issue.type}] ${issue.id} ${issue.field}: ${issue.snippet}`;
}

function countBy(entries, key) {
  const counts = {};
  for (const entry of entries) {
    counts[entry[key]] = (counts[entry[key]] ?? 0) + 1;
  }
  return counts;
}

function failureType(error) {
  if (error.code === "ARGUMENT_ERROR") return "argument-error";
  if (error.code === "BASELINE_ERROR") return "baseline-error";
  return "internal-error";
}

function failureCategory(error) {
  return error.code === "ARGUMENT_ERROR" || error.code === "BASELINE_ERROR"
    ? "cli"
    : "internal";
}

export async function main(argv = process.argv.slice(2)) {
  let options = {
    root: ".",
    json: argv.includes("--json"),
    top: DEFAULT_TOP,
  };
  let result;

  try {
    options = parseArgs(argv);
    if (options.help) {
      const help = [
        "Usage: node scripts/archive-quality.mjs [--root <path>] [--json] [--top <n>] [--write-baseline <path>] [--compare-baseline <path>] [--risk-report]",
        "",
        "--top <n> controls both largest problem JSON preview and risk report top count.",
        "",
      ].join("\n");
      process.stdout.write(help);
      process.exitCode = 0;
      return;
    }
    const baselineForCompare = options.compareBaseline
      ? await readBaselineFile(path.resolve(options.compareBaseline))
      : null;

    result = await scanArchive(options);

    if (options.riskReport) {
      result.riskReport = calculateRiskReport(result, { top: options.top });
    }

    if (options.writeBaseline) {
      const baseline = createBaseline(result, { top: options.top });
      const baselinePath = path.resolve(options.writeBaseline);
      try {
        await writeBaselineFile(baselinePath, baseline);
        result.baselineWrite = {
          status: "written",
          path: normalizePathSeparators(options.writeBaseline),
          issueCount: baseline.summary.issueCount,
          errorCount: baseline.summary.errorCount,
          warningCount: baseline.summary.warningCount,
        };
      } catch (error) {
        result.baselineWrite = {
          status: "error",
          path: normalizePathSeparators(options.writeBaseline),
          message: error.message,
        };
        result.exitCode = 1;
      }
    }

    if (baselineForCompare) {
      result.baselineCompare = compareBaseline(result, baselineForCompare);
      result.exitCode = result.baselineCompare.exitCode;
    }
  } catch (error) {
    result = createFailureResult({
      root: options.root,
      options,
      type: failureType(error),
      category: failureCategory(error),
      message: error.message,
    });
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatHumanReport(result));
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const options = {
      root: ".",
      json: process.argv.includes("--json"),
      top: DEFAULT_TOP,
    };
    const result = createFailureResult({
      root: options.root,
      options,
      type: "internal-error",
      category: "internal",
      message: error.message,
    });
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : formatHumanReport(result));
    process.exitCode = 1;
  });
}
