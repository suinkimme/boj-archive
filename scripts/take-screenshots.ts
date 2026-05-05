import { chromium } from "playwright";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const BASE_URL = "http://localhost:3000";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadToR2(filePath: string, key: string): Promise<string> {
  const body = readFileSync(filePath);
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

interface Shot {
  name: string;
  url: string;
  waitFor?: string;
  beforeShot?: (page: import("playwright").Page) => Promise<void>;
}

const shots: Shot[] = [
  {
    name: "problem-list",
    url: "/",
    waitFor: "ul li, table tr, .grid > div",
  },
  {
    name: "problem-detail-editor",
    url: "/problems/1000",
    waitFor: ".cm-editor",
    beforeShot: async (page) => {
      // Scroll down a bit to show the editor in focus
      await page.evaluate(() => window.scrollBy(0, 0));
    },
  },
  {
    name: "problem-detail-submissions",
    url: "/problems/1000?tab=history",
    waitFor: ".cm-editor",
  },
  {
    name: "notices",
    url: "/notices",
  },
  {
    name: "about",
    url: "/about",
  },
];

async function takeShot(
  page: import("playwright").Page,
  shot: Shot
): Promise<string> {
  await page.goto(`${BASE_URL}${shot.url}`, {
    waitUntil: "networkidle",
    timeout: 20000,
  });

  if (shot.waitFor) {
    await page
      .locator(shot.waitFor)
      .first()
      .waitFor({ state: "visible", timeout: 10000 })
      .catch(() => {});
  }

  await page.waitForTimeout(1000);

  if (shot.beforeShot) {
    await shot.beforeShot(page);
    await page.waitForTimeout(500);
  }

  // Hide the nav
  await page.evaluate(() => {
    const nav = document.querySelector("nav");
    if (nav) {
      (nav as HTMLElement).style.display = "none";
    }
  });

  await page.waitForTimeout(300);

  const tmpFile = path.join(
    os.tmpdir(),
    `screenshot-${crypto.randomBytes(4).toString("hex")}.png`
  );

  await page.screenshot({ path: tmpFile, fullPage: true });
  return tmpFile;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const results: Record<string, string> = {};

  for (const shot of shots) {
    console.log(`📸 Capturing: ${shot.name}`);
    try {
      const tmpFile = await takeShot(page, shot);
      const key = `update-notes/${shot.name}.png`;
      const url = await uploadToR2(tmpFile, key);
      results[shot.name] = url;
      console.log(`  ✅ ${url}`);
    } catch (e) {
      console.error(`  ❌ Failed: ${e}`);
    }
  }

  await browser.close();

  console.log("\n📋 Results:");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
