import dotenv from "dotenv";
import { withSession, waitForPrimeFacesIdle } from "./edugateSession.js";
import { SELECTORS } from "./selectors.js";
import { classifyPortalMessage, normalizeArabicMessage } from "./messages.js";

dotenv.config();

const ONLINE_REGISTRATION_URL = SELECTORS.URLS.onlineRegistration;

/**
 * Checks whether the official PTUK Edugate online registration window is open for the given student.
 * Returns a typed status enum as defined in Phase 1 of ptuk-registration-api:
 * 'portal_open' | 'portal_closed' | 'financial_hold' | 'login_failed' | 'portal_unreachable' | 'unknown_page'
 *
 * @param {string} studentId
 * @param {string} password
 * @returns {Promise<{ isOpen: boolean, status: string, message: string, rawNotice?: string }>}
 */
export async function checkOnlineRegistrationStatus(studentId, password) {
  if (!studentId || !password) {
    throw new Error(
      "الرقم الجامعي وكلمة المرور مطلوبان للتحقق من بوابة التسجيل.",
    );
  }

  try {
    return await withSession(async (page) => {
      try {
        await page.goto(ONLINE_REGISTRATION_URL, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      } catch (navErr) {
        return {
          isOpen: false,
          status: "portal_unreachable",
          message: `تعذر الوصول إلى سيرفر بوابة الجامعة Edugate: ${navErr.message}`,
        };
      }

      // 1. Handle authentication if redirected to login page
      const passInput = page.locator(SELECTORS.LOGIN.passwordInput).first();
      if ((await passInput.count()) > 0) {
        await page.fill(SELECTORS.LOGIN.usernameInput, studentId);
        await passInput.fill(password);
        await Promise.all([
          page
            .waitForNavigation({
              waitUntil: "domcontentloaded",
              timeout: 15000,
            })
            .catch(() => {}),
          page.click(SELECTORS.LOGIN.submitButton),
        ]);

        // Check if login failed
        if ((await page.locator(SELECTORS.LOGIN.passwordInput).count()) > 0) {
          const errorMsg = await page
            .locator(SELECTORS.LOGIN.errorMessage)
            .first()
            .textContent()
            .catch(() => null);

          return {
            isOpen: false,
            status: "login_failed",
            message:
              errorMsg?.trim() || "بيانات الدخول غير صحيحة في بوابة الجامعة.",
          };
        }
      }

      // 2. Ensure we are on the onlineRegistration view
      if (
        !page.url().includes("onlineRegistration") &&
        !page.url().includes("courseRegistration")
      ) {
        await page
          .goto(ONLINE_REGISTRATION_URL, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          })
          .catch(() => {});
      }

      // 3. Inspect the live registration page DOM
      const inspection = await page.evaluate(() => {
        const text = (
          document.body?.innerText ||
          document.body?.textContent ||
          ""
        ).trim();
        const norm = text.replace(/\s+/g, " ");

        const isFinancial =
          norm.includes("مراجعة الدائرة المالية") ||
          norm.includes("الدائرة المالية") ||
          norm.includes("قيد مالي") ||
          norm.includes("براءة ذمة");

        const isNoticeClosed =
          norm.includes("غير متاح") ||
          norm.includes("غير مفتوح") ||
          norm.includes("التسجيل مغلق") ||
          norm.includes("لا يمكنك التسجيل") ||
          norm.includes("فترة التسجيل غير متاحة") ||
          norm.includes("موعد التسجيل غير متاح");

        const hasActionForm =
          document.querySelectorAll(
            "form input[type='text'], form select, .ui-button, table",
          ).length > 0;

        return {
          url: window.location.href,
          textSnippet: text.slice(0, 400),
          isFinancial,
          isNoticeClosed,
          hasActionForm,
        };
      });

      if (inspection.isFinancial) {
        return {
          isOpen: false,
          status: "financial_hold",
          message:
            "نافذة التسجيل مقيدة حالياً بسبب قيد مالي أو ضرورة مراجعة الدائرة المالية لتسديد الرسوم.",
          rawNotice: inspection.textSnippet,
        };
      }

      if (inspection.isNoticeClosed) {
        return {
          isOpen: false,
          status: "portal_closed",
          message:
            "نافذة التسجيل الإلكتروني مغلقة حالياً حسب التقويم الأكاديمي لجامعة خضوري.",
          rawNotice: inspection.textSnippet,
        };
      }

      if (inspection.hasActionForm) {
        return {
          isOpen: true,
          status: "portal_open",
          message: "بوابة التسجيل الإلكتروني في خضوري متاحة للتسجيل الآن.",
          rawNotice: inspection.textSnippet,
        };
      }

      return {
        isOpen: false,
        status: "unknown_page",
        message:
          "تم فتح البوابة ولكن استجابة الصفحة غير مألوفة أو قيد التحديث.",
        rawNotice: inspection.textSnippet,
      };
    });
  } catch (err) {
    return {
      isOpen: false,
      status: "portal_unreachable",
      message: `خطأ في الاتصال بالبوابة: ${err.message}`,
    };
  }
}

/**
 * Performs automated registration on PTUK Edugate with cascading plan fallback.
 * Strictly adheres to the Fail-Closed and State-Verification principles.
 *
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.password
 * @param {Array<object>} params.items
 * @param {object} params.plans
 * @param {object} [params.options]
 * @returns {Promise<object>}
 */
export async function executeRealEdugateRegistration({
  studentId,
  password,
  items = [],
  plans = {},
  options = {},
}) {
  const startTime = Date.now();
  const { targetPlan = "A", autoFallbackOnFull = true } = options;

  return await withSession(async (page) => {
    console.log(
      `🚀 [LIVE REGISTRATION] Connecting student (${studentId}) to Edugate onlineRegistration...`,
    );

    // 1. Navigate to online registration
    await page.goto(ONLINE_REGISTRATION_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // 2. Perform Login if password form presents
    const passInput = page.locator(SELECTORS.LOGIN.passwordInput).first();
    if ((await passInput.count()) > 0) {
      await page.fill(SELECTORS.LOGIN.usernameInput, studentId);
      await passInput.fill(password);
      await Promise.all([
        page
          .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
          .catch(() => {}),
        page.click(SELECTORS.LOGIN.submitButton),
      ]);

      // Check login error
      if ((await page.locator(SELECTORS.LOGIN.passwordInput).count()) > 0) {
        const errorMsg = await page
          .locator(SELECTORS.LOGIN.errorMessage)
          .first()
          .textContent()
          .catch(() => null);

        throw new Error(
          errorMsg?.trim() || "بيانات الدخول غير صحيحة في بوابة خضوري.",
        );
      }
    }

    // 3. Ensure we are landed on the registration view
    if (
      !page.url().includes("onlineRegistration") &&
      !page.url().includes("courseRegistration")
    ) {
      await page
        .goto(ONLINE_REGISTRATION_URL, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        })
        .catch(() => {});
    }

    // 4. Check portal state (closed window, financial hold, etc.)
    const pageInspection = await page.evaluate(() => {
      const text = (
        document.body?.innerText ||
        document.body?.textContent ||
        ""
      ).trim();
      const norm = text.replace(/\s+/g, " ");

      const isFinancial =
        norm.includes("مراجعة الدائرة المالية") ||
        norm.includes("الدائرة المالية") ||
        norm.includes("قيد مالي") ||
        norm.includes("براءة ذمة");

      const isClosed =
        norm.includes("غير متاح") ||
        norm.includes("غير مفتوح") ||
        norm.includes("التسجيل مغلق") ||
        norm.includes("فترة التسجيل غير متاحة") ||
        norm.includes("لا يمكنك التسجيل") ||
        norm.includes("موعد التسجيل غير متاح");

      return {
        isFinancial,
        isClosed,
        textSnippet: text.slice(0, 500),
      };
    });

    if (pageInspection.isFinancial || pageInspection.isClosed) {
      const failureCode = pageInspection.isFinancial
        ? "FINANCIAL_HOLD"
        : "PORTAL_WINDOW_CLOSED";
      const failureMsg = pageInspection.isFinancial
        ? "نافذة التسجيل مقيدة حالياً بسبب قيد مالي أو عدم استكمال براءة الذمة في الدائرة المالية."
        : "نافذة التسجيل في بوابة الجامعة غير مفتوحة حالياً حسب التقويم الأكاديمي.";

      console.warn(`⚠️ [LIVE REGISTRATION] Portal blocked: ${failureCode}`);

      const results = items.map((item) => ({
        courseId: item.courseId,
        courseName: item.courseName,
        section: item.section,
        originalPlan: targetPlan,
        effectivePlan: targetPlan,
        effectiveSection: item.section,
        status: pageInspection.isFinancial ? "financial_hold" : "portal_closed",
        message: failureMsg,
        retriesCount: 1,
        timestamp: new Date().toISOString(),
        fallbackUsed: false,
        verified: false,
      }));

      return {
        status: pageInspection.isFinancial ? "financial_hold" : "portal_closed",
        activePlan: targetPlan,
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
        totalItems: items.length,
        registeredCount: 0,
        failedCount: items.length,
        items: results,
        diagnostics: [
          {
            type: "warning",
            code: failureCode,
            title: pageInspection.isFinancial
              ? "قيد مالي مطلوب تسديده"
              : "فترة التسجيل غير متاحة حالياً",
            detail: pageInspection.textSnippet || failureMsg,
          },
        ],
        isOfficial: true,
        isSimulation: false,
        portalNotice: pageInspection.textSnippet,
        disclaimer:
          "تم الاتصال الرسمي ببوابة الجامعة https://edugate.ptuk.edu.ps/student/onlineRegistration وتبين أن التسجيل غير متاح للطالب حالياً.",
      };
    }

    // 5. Check if actionable registration DOM components exist
    const courseInputLocator = page
      .locator(SELECTORS.REGISTRATION_FORM.candidateCourseInput)
      .first();
    const addButtonLocator = page
      .locator(SELECTORS.REGISTRATION_FORM.candidateAddButton)
      .first();

    const hasCourseInput = (await courseInputLocator.count()) > 0;
    const hasAddButton = (await addButtonLocator.count()) > 0;

    // Fail-Closed: If the DOM does not match verified selectors, STOP and report safely!
    if (!hasCourseInput || !hasAddButton) {
      console.warn(
        "🛡️ [FAIL CLOSED] Required registration elements not identified on page. Halting safely.",
      );

      const results = items.map((item) => ({
        courseId: item.courseId,
        courseName: item.courseName,
        section: item.section,
        originalPlan: targetPlan,
        effectivePlan: targetPlan,
        effectiveSection: item.section,
        status: "failed",
        errorCode: "EVIDENCE_REQUIRED",
        message:
          "لم يتم العثور على أزرار إضافة المساقات المعتمدة في واجهة الصفحة الحالية. تطبيقاً لمبدأ الأمان (Fail-Closed) لم يتم العبث بحسابك الجامعي.",
        retriesCount: 1,
        timestamp: new Date().toISOString(),
        fallbackUsed: false,
        verified: false,
      }));

      return {
        status: "failed",
        activePlan: targetPlan,
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
        totalItems: items.length,
        registeredCount: 0,
        failedCount: items.length,
        items: results,
        diagnostics: [
          {
            type: "error",
            code: "UNVERIFIED_PORTAL_STRUCTURE",
            title: "هيكل صفحة التسجيل بحاجة لتوثيق (Evidence Required)",
            detail:
              "لم تتعرف خوارزمية الأتمتة على أزرار التثبيت في صفحة Edugate الحالية. لمنع أي تسجيل خاطئ أو عبث بالسجل، تم إيقاف العملية بأمان (Fail-Closed).",
          },
        ],
        isOfficial: true,
        isSimulation: false,
        portalNotice: pageInspection.textSnippet,
        disclaimer:
          "تم إيقاف المحاولة بأمان لعدم مطابقة عناصر الصفحة مع الأدلة الموثقة. سجلك الجامعي لم يتأثر.",
      };
    }

    // 6. Actionable Elements ARE Present! Process courses with state verification
    console.log(
      "✅ [LIVE REGISTRATION] Registration controls detected. Processing course items...",
    );
    const results = [];
    const diagnostics = [];
    let registeredCount = 0;
    let failedCount = 0;

    for (const item of items) {
      let currentItem = { ...item };
      let currentPlanKey = targetPlan;
      let fallbackUsed = false;
      let isVerified = false;
      let statusMsg = "";
      let itemStatus = "failed";

      try {
        await courseInputLocator.fill(currentItem.courseId);

        const sectionLocator = page
          .locator(SELECTORS.REGISTRATION_FORM.candidateSectionInput)
          .first();
        if ((await sectionLocator.count()) > 0) {
          await sectionLocator.fill(String(currentItem.section));
        }

        await addButtonLocator.click();
        await waitForPrimeFacesIdle(page);

        // Read and classify growl / notification messages
        const noticeText = await page
          .locator(SELECTORS.NOTICES.growl + ", " + SELECTORS.NOTICES.messages)
          .first()
          .textContent()
          .catch(() => "");

        const classified = classifyPortalMessage(noticeText || "");

        if (
          classified.code === "SECTION_FULL" ||
          classified.code === "TIME_CONFLICT"
        ) {
          // Attempt immediate reserveSection or fallback plan
          if (autoFallbackOnFull && currentItem.reserveSection) {
            fallbackUsed = true;
            currentItem.section = currentItem.reserveSection;

            if ((await sectionLocator.count()) > 0) {
              await sectionLocator.fill(String(currentItem.section));
              await addButtonLocator.click();
              await waitForPrimeFacesIdle(page);
            }
          }
        }

        // Verify state: re-read registered courses table to confirm persistence
        const tableText = await page
          .locator(SELECTORS.REGISTRATION_FORM.registeredCoursesTable)
          .textContent()
          .catch(() => "");

        if (tableText.includes(currentItem.courseId)) {
          isVerified = true;
          itemStatus = "registered";
          statusMsg = `تم تثبيت تسجيل المساق (${currentItem.courseId}) الشعبة (${currentItem.section}) بنجاح.`;
        } else if (
          classified.code !== "NO_MESSAGE" &&
          classified.code !== "UNKNOWN_MESSAGE"
        ) {
          itemStatus = "failed";
          statusMsg = classified.userMessage;
        } else {
          itemStatus = "failed";
          statusMsg =
            "لم يظهر المساق في جدول المساقات المسجلة بعد إرسال الطلب.";
        }
      } catch (err) {
        itemStatus = "failed";
        statusMsg = `خطأ أثناء تنفيذ العملية: ${err.message}`;
      }

      if (itemStatus === "registered") {
        registeredCount++;
      } else {
        failedCount++;
      }

      results.push({
        courseId: item.courseId,
        courseName: item.courseName,
        section: item.section,
        originalPlan: targetPlan,
        effectivePlan: currentPlanKey,
        effectiveSection: currentItem.section,
        status: itemStatus,
        message: statusMsg,
        retriesCount: 1,
        timestamp: new Date().toISOString(),
        fallbackUsed,
        verified: isVerified,
      });
    }

    // 7. Click final submission button if present and at least one item was registered
    const submitBtn = page
      .locator(SELECTORS.REGISTRATION_FORM.candidateSubmitButton)
      .first();
    if (registeredCount > 0 && (await submitBtn.count()) > 0) {
      await submitBtn.click();
      await waitForPrimeFacesIdle(page);
    }

    return {
      status:
        registeredCount === items.length
          ? "completed"
          : registeredCount > 0
            ? "partial"
            : "failed",
      activePlan: targetPlan,
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      totalItems: items.length,
      registeredCount,
      failedCount,
      items: results,
      diagnostics,
      isOfficial: true,
      isSimulation: false,
      disclaimer:
        "تم تنفيذ الطلب عبر الاتصال المباشر ببوابة جامعة فلسطين التقنية - خضوري مع التحقق من الحالة.",
    };
  });
}
