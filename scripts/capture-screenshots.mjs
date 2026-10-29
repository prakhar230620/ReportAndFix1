const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

const BASE_URL = (process.env.SCREENSHOT_BASE_URL || "https://reportandfix-nine.vercel.app").replace(/\/+$/, "");
const OUTPUT_DIR = path.resolve("artifacts/screenshots");
const MAX_PAGES = Number(process.env.SCREENSHOT_MAX_PAGES || 40);
const VIEWPORT = { width: 1920, height: 1080 };

const roles = [
  { name: "super-admin", email: process.env.SHOT_SUPER_ADMIN_EMAIL, password: process.env.SHOT_SUPER_ADMIN_PASSWORD, start: "/super-admin", routes: ["/super-admin", "/super-admin/analytics", "/super-admin/export", "/super-admin/inquiries", "/super-admin/plans", "/super-admin/transactions", "/super-admin/admin-requests", "/profile"], allowed: (p) => p === "/profile" || p === "/super-admin" || p.startsWith("/super-admin/") },
  { name: "departmental-admin", email: process.env.SHOT_DEPT_ADMIN_EMAIL, password: process.env.SHOT_DEPT_ADMIN_PASSWORD, start: "/dept-admin", routes: ["/dept-admin", "/dept-admin/analytics", "/dept-admin/queue", "/dept-admin/workers", "/dept-admin/messages", "/profile"], allowed: (p) => p === "/profile" || p === "/dept-admin" || p.startsWith("/dept-admin/") },
  { name: "worker", email: process.env.SHOT_WORKER_EMAIL, password: process.env.SHOT_WORKER_PASSWORD, start: "/worker", routes: ["/worker", "/worker/messages", "/profile"], allowed: (p) => p === "/profile" || p === "/worker" || p.startsWith("/worker/") },
  { name: "user", email: process.env.SHOT_USER_EMAIL, password: process.env.SHOT_USER_PASSWORD, start: "/", routes: ["/", "/feed", "/locations", "/docs", "/profile"], allowed: (p) => p === "/" || ["/feed", "/locations", "/docs", "/profile"].includes(p) || p.startsWith("/issues/") || p.startsWith("/report/") },
];

function safeName(route) {
  if (route === "/") return "home";
  return route.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+$/, "");
}

function shouldSkip(p) {
  return p.startsWith("/api/") || p.startsWith("/auth/") || p.startsWith("/signup") || p.startsWith("/login") || p.startsWith("/forgot-password") || p.startsWith("/reset-password") || p.includes("/cancel") || p.includes("/approve") || p.includes("/execute") || p.includes("/delete") || p.includes("/logout") || p.includes("/signout") || p.includes("/qr-sheet");
}

async function login(page, role) {
  if (!role.email || !role.password) throw new Error("Missing GitHub Actions secrets for role " + role.name + ".");
  await page.goto(BASE_URL + "/login?next=" + encodeURIComponent(role.start), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator('input[name="email"]').fill(role.email);
  await page.locator('input[name="password"]').fill(role.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForTimeout(1800);
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Login failed for " + role.name + ". Check credentials, MFA, and onboarding.");
  await page.goto(BASE_URL + role.start, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(900);
  if (new URL(page.url()).pathname.startsWith("/login")) throw new Error("Account " + role.name + " was redirected to login; check access to " + role.start + ".");
}

async function capture(page, roleName, route) {
  try { await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 45000 }); }
  catch { await page.goto(BASE_URL + route, { waitUntil: "domcontentloaded", timeout: 45000 }); }
  await page.waitForTimeout(700);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  if (new URL(page.url()).pathname.startsWith("/login")) { console.warn("[SKIP] " + roleName + " " + route + " redirected to login."); return false; }
  const destination = path.join(OUTPUT_DIR, roleName, safeName(route) + ".png");
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await page.screenshot({ path: destination, fullPage: true, animations: "disabled" });
  console.log("[OK] " + roleName + ": " + route + " -> " + destination);
  return true;
}

async function discoverLinks(page, role) {
  const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter(Boolean));
  const found = [];
  for (const href of hrefs) {
    try { const url = new URL(href, BASE_URL); if (url.origin !== new URL(BASE_URL).origin) continue; if (shouldSkip(url.pathname) || !role.allowed(url.pathname)) continue; found.push(url.pathname); }
    catch { /* Ignore malformed links. */ }
  }
  return [...new Set(found)];
}

async function main() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let total = 0;
  const failures = [];
  try {
    for (const role of roles) {
      if (total >= MAX_PAGES) break;
      const context = await browser.newContext({ viewport: VIEWPORT, screen: VIEWPORT, deviceScaleFactor: 1, isMobile: false, hasTouch: false, reducedMotion: "reduce" });
      const page = await context.newPage();
      try {
        console.log("\n=== Role: " + role.name + " ===");
        await login(page, role);
        const queue = [...new Set(role.routes)];
        const visited = new Set();
        while (queue.length && total < MAX_PAGES) {
          const route = queue.shift();
          if (!route || visited.has(route) || shouldSkip(route) || !role.allowed(route)) continue;
          visited.add(route);
          try {
            const saved = await capture(page, role.name, route);
            if (saved) total++;
            const discovered = await discoverLinks(page, role);
            for (const link of discovered) if (!visited.has(link) && !queue.includes(link)) queue.push(link);
          } catch (error) { const message = error instanceof Error ? error.message : String(error); failures.push(role.name + " " + route + ": " + message); console.warn("[WARN] " + role.name + " " + route + ": " + message); }
        }
      } catch (error) { const message = error instanceof Error ? error.message : String(error); failures.push(role.name + " login/setup: " + message); console.error("[ERROR] " + role.name + ": " + message); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  const summary = ["Base URL: " + BASE_URL, "Viewport: 1920x1080", "Capture mode: full page", "Screenshots saved: " + total, "Failures: " + failures.length, ...failures.map((f) => "- " + f)].join("\n");
  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile(path.join("artifacts", "screenshots-summary.txt"), summary, "utf8");
  console.log("\n" + summary);
  if (total === 0) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });