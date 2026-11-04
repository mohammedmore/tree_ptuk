import { chromium } from "playwright";

/**
 * Manages the Playwright browser lifecycle for PTUK Edugate interactions.
 */
export class EdugateSession {
  constructor({ headless = true, timeoutMs = 25000 } = {}) {
    this.headless = headless;
    this.timeoutMs = timeoutMs;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async open() {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    this.context = await this.browser.newContext({
      locale: "ar-PS",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    this.context.setDefaultTimeout(this.timeoutMs);

    // Filter heavy media to minimize bandwidth and accelerate PrimeFaces interactions
    await this.context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") {
        return route.abort();
      }
      return route.continue();
    });

    this.page = await this.context.newPage();
    return this;
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

/**
 * Executes a function within a guaranteed browser session lifecycle.
 *
 * @template T
 * @param {(page: import('playwright').Page, session: EdugateSession) => Promise<T>} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export async function withSession(fn, options = {}) {
  const session = await new EdugateSession(options).open();
  try {
    return await fn(session.page, session);
  } finally {
    await session.close();
  }
}

/**
 * Waits for PrimeFaces AJAX queue to become idle.
 *
 * @param {import('playwright').Page} page
 * @param {number} [timeout=15000]
 * @returns {Promise<void>}
 */
export async function waitForPrimeFacesIdle(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => {
        const pf = window.PrimeFaces;
        if (!pf || !pf.ajax || !pf.ajax.Queue) return true;
        return pf.ajax.Queue.isEmpty() !== false;
      },
      null,
      { timeout },
    );
  } catch {
    // If timeout or PrimeFaces not present, proceed safely
  }
}
