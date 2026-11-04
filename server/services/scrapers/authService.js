import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config();

const DEFAULT_SCHEDULE_URL =
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/scheduleCourses/index.xhtml";

/**
 * Authenticate to PTUK Edugate and return the browser session needed by the
 * JSF schedule scraper.
 *
 * @returns {Promise<{ cookie: string, viewState: string }>}
 */
export async function authenticatePTUK(customUsername, customPassword) {
  const username = (customUsername || process.env.PTUK_USERNAME)?.trim();
  const password =
    customPassword !== undefined ? customPassword : process.env.PTUK_PASSWORD;

  if (!username || !password) {
    throw new Error("PTUK_USERNAME and PTUK_PASSWORD must be configured.");
  }

  let browser;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    await page.goto(DEFAULT_SCHEDULE_URL, { waitUntil: "domcontentloaded" });

    const passwordField = page.locator('input[type="password"]').first();
    if ((await passwordField.count()) > 0) {
      await page.fill('input[type="text"], input[name*="user"]', username);
      await page.fill('input[type="password"]', password);
      await page.click(
        'button[type="submit"], input[type="submit"], .ui-button',
      );
      await page.waitForLoadState("networkidle");

      if ((await page.locator('input[type="password"]').count()) > 0) {
        throw new Error(
          "PTUK Edugate did not accept the supplied credentials.",
        );
      }

      await page.goto(DEFAULT_SCHEDULE_URL, {
        waitUntil: "networkidle",
      });
    }

    // 1. Select Branch dropdown (الدراسة النظامية - طولكرم = "1")
    const branchSelect = page.locator(
      '#contents\\:j_idt117_input, select[name*="j_idt117"]',
    );
    if ((await branchSelect.count()) > 0) {
      await branchSelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }

    const searchButton = page
      .locator(
        'button[id*="scheduleDtl"], button:has-text("بحث"), button:has-text("Search"), span:has-text("بحث")',
      )
      .first();

    if ((await searchButton.count()) > 0) {
      await searchButton.click();
    } else {
      await page.click('.ui-button[type="submit"]');
    }

    await page.waitForLoadState("networkidle");
    await page
      .waitForSelector("#contents\\:scheduleDtl_data tr, table tbody tr", {
        timeout: 15000,
      })
      .catch(() => console.log("لم يتم العثور على جدول بعد البحث."));
    await page.waitForTimeout(1500);

    const sessionCookies = await context.cookies(DEFAULT_SCHEDULE_URL);
    const sessionCookie = sessionCookies.find(
      ({ name }) => name === "JSESSIONID",
    );

    if (!sessionCookie) {
      throw new Error(
        "PTUK Edugate did not provide a JSESSIONID session cookie.",
      );
    }

    const cookie = sessionCookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    const viewState = await page
      .locator('input[name="javax.faces.ViewState"]')
      .first()
      .getAttribute("value");

    if (!viewState?.trim()) {
      throw new Error(
        "Could not find javax.faces.ViewState on the schedule page.",
      );
    }

    return { success: true, cookie, viewState: viewState.trim() };
  } catch (error) {
    if (
      page &&
      process.env.NODE_ENV !== "production" &&
      process.env.DEBUG_SCREENSHOTS === "true"
    ) {
      try {
        await page.screenshot({
          path: "login-failed-debug.png",
          fullPage: true,
        });
      } catch (screenshotError) {
        console.error(
          "Could not save PTUK login debug screenshot:",
          screenshotError,
        );
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PTUK authentication failed: ${message}`, { cause: error });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default authenticatePTUK;
