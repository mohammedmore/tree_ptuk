import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { checkOnlineRegistrationStatus } from "../server/services/scrapers/edugateLiveRegistration.js";
import { withSession } from "../server/services/scrapers/edugateSession.js";
import { SELECTORS } from "../server/services/scrapers/selectors.js";

dotenv.config();

const studentId = process.argv[2] || process.env.PTUK_USERNAME;
const password = process.argv[3] || process.env.PTUK_PASSWORD;

if (!studentId || !password) {
  console.error("❌ الاستخدام: node scripts/inspect-registration-portal.js <studentId> <password>");
  console.error("أو تأكد من ضبط PTUK_USERNAME و PTUK_PASSWORD في ملف .env");
  process.exit(1);
}

console.log("🔍 فحص حالة بوابة التسجيل الإلكتروني في خضوري (PTUK Edugate)...");
console.log(`📌 الطالب: ${studentId}`);
console.log(`🔗 الرابط: ${SELECTORS.URLS.onlineRegistration}\n`);

async function run() {
  try {
    // 1. Run structured portal status check
    console.log("⏳ 1/2 فحص حالة النافذة (Status Classification)...");
    const statusResult = await checkOnlineRegistrationStatus(studentId, password);
    console.log(`\n📊 النتيجة:`);
    console.log(`- الحالة (Status): ${statusResult.status}`);
    console.log(`- مفتوحة للتسجيل (isOpen): ${statusResult.isOpen}`);
    console.log(`- الرسالة: ${statusResult.message}`);
    if (statusResult.rawNotice) {
      console.log(`- نص إشعار البوابة:\n"${statusResult.rawNotice.trim()}"`);
    }

    // 2. Perform deep inspection of DOM and PrimeFaces components
    console.log("\n⏳ 2/2 فحص عميق لعناصر الصفحة وواجهة PrimeFaces...");
    await withSession(async (page) => {
      await page.goto(SELECTORS.URLS.onlineRegistration, { waitUntil: "domcontentloaded", timeout: 20000 });

      // Handle login if required
      const passInput = page.locator(SELECTORS.LOGIN.passwordInput).first();
      if ((await passInput.count()) > 0) {
        await page.fill(SELECTORS.LOGIN.usernameInput, studentId);
        await passInput.fill(password);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
          page.click(SELECTORS.LOGIN.submitButton),
        ]);
      }

      if (!page.url().includes("onlineRegistration") && !page.url().includes("courseRegistration")) {
        await page.goto(SELECTORS.URLS.onlineRegistration, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      }

      const domReport = await page.evaluate(() => {
        const pfVersion = (window as any).PrimeFaces?.version || "غير متاح (Not Loaded)";
        const forms = Array.from(document.querySelectorAll("form")).map((f) => f.id || f.name || "unnamed");
        const buttons = Array.from(document.querySelectorAll("button, input[type='submit'], .ui-button"))
          .map((b) => (b.textContent || (b as HTMLInputElement).value || "").trim())
          .filter(Boolean);
        const inputs = Array.from(document.querySelectorAll("input, select, textarea"))
          .map((i) => ({
            id: i.id || "",
            name: (i as HTMLInputElement).name || "",
            type: (i as HTMLInputElement).type || i.tagName.toLowerCase(),
          }))
          .filter((i) => i.type !== "hidden");
        const tables = Array.from(document.querySelectorAll("table")).map((t) => t.id || "unnamed table");

        // Sanitize sensitive personal numbers or passwords
        let sanitizedHtml = document.documentElement.outerHTML;
        sanitizedHtml = sanitizedHtml.replace(/[0-9]{9}/g, "XXXXXXXXX");

        return {
          currentUrl: window.location.href,
          pfVersion,
          forms,
          buttonsCount: buttons.length,
          buttonsList: buttons.slice(0, 15),
          inputsCount: inputs.length,
          inputsSample: inputs.slice(0, 10),
          tables,
          sanitizedHtml,
        };
      });

      console.log(`\n🧩 تقرير واجهة PrimeFaces و DOM:`);
      console.log(`- إصدار PrimeFaces: ${domReport.pfVersion}`);
      console.log(`- النماذج (Forms): ${domReport.forms.join(", ") || "لا توجد"}`);
      console.log(`- الجداول (Tables): ${domReport.tables.join(", ") || "لا توجد"}`);
      console.log(`- عدد الأزرار المتاحة: ${domReport.buttonsCount} (عينات: ${domReport.buttonsList.join(" | ")})`);
      console.log(`- عدد حقول الإدخال: ${domReport.inputsCount}`);

      // Save sanitized snapshot for fixture evidence
      const fixturesDir = path.resolve("server/services/scrapers/__fixtures__");
      await fs.mkdir(fixturesDir, { recursive: true });
      const fixturePath = path.join(fixturesDir, "registration_page_snapshot.html");
      await fs.writeFile(fixturePath, domReport.sanitizedHtml, "utf-8");
      console.log(`\n💾 تم حفظ نسخة هيكل الصفحة المنقحة للأدلة في:\n${fixturePath}`);
    });

    console.log("\n✅ اكتمل الفحص بنجاح.");
  } catch (err) {
    console.error("\n❌ حدث خطأ أثناء الفحص:", err.message);
  }
}

run();
