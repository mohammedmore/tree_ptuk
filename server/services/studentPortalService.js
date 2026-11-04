import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  saveStudentRecord,
  getStudentRecord,
  saveMajorCohortPlan,
  getMajorCohortPlan,
  getMajorById,
  upsertMajor,
  getCourses,
} from "../db.js";
import {
  AI_CURRICULUM_COURSES,
  AI_CATEGORY_REQUIREMENTS,
} from "../majorsData.js";
import { hashStudentPassword, verifyStudentPassword } from "./securityVault.js";
export { AI_CURRICULUM_COURSES, AI_CATEGORY_REQUIREMENTS };

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugifyMajor(name) {
  if (!name) return "major";
  return String(name)
    .trim()
    .replace(/[^\u0621-\u064Aa-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normalizes Arabic-Indic digits (٠-٩) and Persian digits (۰-۹) to standard ASCII (0-9)
 * and strips diacritics/tashkeel.
 */
export function normalizeDigitsAndText(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .trim();
}

/**
 * Parses academic year and semester number to calculate a chronological sorting weight.
 * e.g., "الفصل الأول 2021/2022" -> 20211, "الفصل الثاني 2021/2022" -> 20212, "الصيفي 2021/2022" -> 20213
 */
export function parseSemesterWeight(title) {
  const norm = normalizeDigitsAndText(title || "");
  const yearMatch = norm.match(/\b(20\d{2})\b/);
  const startYear = yearMatch
    ? parseInt(yearMatch[1], 10)
    : new Date().getFullYear();

  let termIndex = 1;
  if (
    norm.includes("ثاني") ||
    norm.includes("الثاني") ||
    norm.includes("2nd") ||
    norm.includes("Second")
  ) {
    termIndex = 2;
  } else if (
    norm.includes("صيفي") ||
    norm.includes("الصيفي") ||
    norm.includes("الدورة الصيفية") ||
    norm.includes("Summer")
  ) {
    termIndex = 3;
  } else if (
    norm.includes("أول") ||
    norm.includes("الأول") ||
    norm.includes("1st") ||
    norm.includes("First")
  ) {
    termIndex = 1;
  }

  return startYear * 10 + termIndex;
}

function isRemedialCourseCode(code, name, category) {
  const normCode = String(code || "").trim();
  if (
    normCode === "15200099" ||
    normCode === "13010006" ||
    normCode === "15200098"
  )
    return true;
  if (
    category === "متطلب استدراكي إجباري" ||
    category === "متطلب استدراكي" ||
    category === "استدراكي"
  ) {
    return true;
  }
  if (typeof name === "string") {
    if (name.includes("استدراكي") || name.includes("مهارات الحاسوب")) {
      return true;
    }
  }
  return false;
}

function extractCoursesFromDataTs() {
  try {
    const dataTsPath = join(__dirname, "..", "..", "src", "data.ts");
    if (!existsSync(dataTsPath)) return [];
    const content = readFileSync(dataTsPath, "utf8");
    const coursesMatch = content.match(
      /export const courses:\s*Course\[\]\s*=\s*\[([\s\S]*?)\];/,
    );
    if (!coursesMatch) return [];

    const rawCoursesBlock = coursesMatch[1];
    const courseRegex =
      /\{[\s\S]*?id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?prerequisites:\s*(\[[^\]]*\])[\s\S]*?credits:\s*(\d+)[\s\S]*?category:\s*"([^"]+)"([\s\S]*?)\}/g;

    const courses = [];
    let match;
    while ((match = courseRegex.exec(rawCoursesBlock)) !== null) {
      const [, id, name, prereqsRaw, credits, category] = match;
      let prerequisites = [];
      try {
        prerequisites = JSON.parse(prereqsRaw.replace(/'/g, '"'));
      } catch {}
      courses.push({
        id,
        code: id,
        name,
        prerequisites,
        coPrerequisites: [],
        credits: parseInt(credits, 10),
        category,
        seasonal: "both",
      });
    }
    return courses;
  } catch (err) {
    console.warn(
      "⚠️ Failed to parse fallback courses from src/data.ts:",
      err.message,
    );
    return [];
  }
}

/**
 * Accurately infer the student's major and faculty from their course codes and names.
 * Ground Truth rule: A student's registered or completed courses are 100% indisputable evidence of their major.
 */
export function inferMajorFromCourses(courses = [], studentId = "") {
  const normId = String(studentId || "").trim();
  const allCodes = Array.isArray(courses)
    ? courses.map((c) => String(c.id || c.code || ""))
    : [];
  const allNames = Array.isArray(courses)
    ? courses.map((c) => String(c.name || ""))
    : [];

  const hasAi =
    allCodes.some((c) => c.startsWith("1903")) ||
    allNames.some(
      (n) =>
        n.includes("ذكاء اصطناعي") ||
        n.includes("تعلم الالة") ||
        n.includes("رؤية الحاسوب") ||
        n.includes("معالجة اللغات"),
    );
  if (hasAi) {
    return {
      id: "ai",
      name: "الذكاء الاصطناعي",
      college: "كلية تكنولوجيا المعلومات والاتصالات",
    };
  }

  const hasSwe =
    allCodes.some((c) => c.startsWith("1215") || c === "19041343") ||
    allNames.some(
      (n) =>
        n.includes("هندسة برمجيات") ||
        n.includes("فحص البرمجيات") ||
        n.includes("جودة البرمجيات"),
    );
  if (hasSwe) {
    return {
      id: "swe",
      name: "هندسة البرمجيات",
      college: "كلية الهندسة والتكنولوجيا",
    };
  }

  const hasCs =
    allCodes.some((c) => c.startsWith("1904") || c.startsWith("1216")) ||
    allNames.some(
      (n) =>
        n.includes("علم الحاسوب") ||
        n.includes("خوارزميات") ||
        n.includes("نظرية الحوسبة"),
    );
  if (hasCs) {
    return {
      id: "cs",
      name: "علم الحاسوب وتكنولوجيا المعلومات",
      college: "كلية تكنولوجيا المعلومات والاتصالات",
    };
  }

  const hasMis =
    allCodes.some((c) => c.startsWith("1901")) ||
    allNames.some(
      (n) =>
        n.includes("نظم المعلومات الإدارية") || n.includes("أعمال إلكترونية"),
    );
  if (hasMis) {
    return {
      id: "mis",
      name: "نظم المعلومات الإدارية والإنترنت",
      college: "كلية تكنولوجيا المعلومات والاتصالات",
    };
  }

  const hasCse =
    allCodes.some((c) => c.startsWith("1214")) ||
    allNames.some(
      (n) => n.includes("أنظمة الحاسوب") || n.includes("معالجات دقيقة"),
    );
  if (hasCse) {
    return {
      id: "cse",
      name: "هندسة أنظمة الحاسوب",
      college: "كلية الهندسة والتكنولوجيا",
    };
  }

  const hasEe =
    allCodes.some((c) => c.startsWith("1211") || c.startsWith("1212")) &&
    !allCodes.some((c) => c.startsWith("1214"));
  if (hasEe) {
    return {
      id: "ee",
      name: "الهندسة الكهربائية والأتمتة الصناعية",
      college: "كلية الهندسة والتكنولوجيا",
    };
  }

  if (
    normId === "202110123" ||
    normId.startsWith("202110") ||
    normId.includes("cse")
  ) {
    return {
      id: "cse",
      name: "هندسة أنظمة الحاسوب",
      college: "كلية الهندسة والتكنولوجيا",
    };
  }
  if (normId.includes("1903") || normId.includes("ai")) {
    return {
      id: "ai",
      name: "الذكاء الاصطناعي",
      college: "كلية تكنولوجيا المعلومات والاتصالات",
    };
  }
  if (normId.includes("1215") || normId.includes("swe")) {
    return {
      id: "swe",
      name: "هندسة البرمجيات",
      college: "كلية الهندسة والتكنولوجيا",
    };
  }
  if (normId.includes("1216") || normId.includes("cs")) {
    return {
      id: "cs",
      name: "علم الحاسوب وتكنولوجيا المعلومات",
      college: "كلية تكنولوجيا المعلومات والاتصالات",
    };
  }

  return {
    id: "ai",
    name: "الذكاء الاصطناعي",
    college: "كلية تكنولوجيا المعلومات والاتصالات",
  };
}

/**
 * Links prerequisite dependencies and allocates academic semesters for any curriculum.
 */
export function applyCurriculumPrerequisitesAndSemesters(
  courses,
  majorId,
  majorName,
) {
  const PREREQ_MAP = {
    // CSE and Engineering Prerequisites
    12140102: ["12140101"], // OOP -> Computer Programming 1
    12140203: ["12140102"], // Data Structures -> OOP
    12140204: ["12140101"], // Discrete Structures -> Computer Programming 1
    12140205: ["12140203"], // Analysis and Design of Algorithms -> Data Structures
    12120207: ["12140101"], // Logic Design -> Computer Programming 1
    12120208: ["12120207"], // Logic Design Lab -> Logic Design
    12110236: ["15020102"], // Electric Circuits -> General Physics 2
    12110237: ["12110236"], // Electric Circuits Lab -> Electric Circuits
    12120205: ["12110236"], // Electronics -> Electric Circuits
    12110316: ["12120207"], // Digital Electronics -> Logic Design
    12140312: ["12140203"], // Computer Networks -> Data Structures
    12140523: ["12140102"], // Web Tech -> OOP
    12110317: ["12120205"], // Microprocessors -> Electronics

    // CS, SWE, AI Prerequisites
    19040113: ["19040112"],
    19030203: ["19040113"],
    19041204: ["19040113"],
    19030201: ["19040113"],
    19041221: ["19040112"],
    19041306: ["19041221", "19030203"],
    19041341: ["19030203"],
    19011304: ["19011200"],
    19041334: ["19041221"],
    19041373: ["19040113"],
    19041371: ["19041334"],
    19041401: ["19041373"],
    19041343: ["19030203"],
    19011407: ["19011200"],

    19030102: ["19040113"],
    19030202: ["19030102", "19041222"],
    19030303: ["19030202"],
    19030304: ["19030303"],
    19030305: ["19030202"],
    19041452: ["19041341"],
    19041461: ["19041452"],
    19041430: ["19030202"],
    19030009: ["19041373"],
    19041506: ["19030009"],
    19030401: ["19030202"],
    19041492: ["19030401"],
    19041491: ["19041306"],

    // General Faculty Core Requirements
    15010102: ["15010101"], // Calculus 2 -> Calculus 1
    15010229: ["15010102"], // Engineering Math 1 -> Calculus 2
    15010230: ["15010102"], // Engineering Math 2 -> Calculus 2
    15010325: ["15010229"], // Numerical Analysis -> Eng Math 1
    19041222: ["15010101"],
    15060101: ["15010101"],
    15020102: ["15020101"], // Physics 2 -> Physics 1
    15020105: ["15020101"], // Physics Lab 1 -> Physics 1
    15020106: ["15020102"], // Physics Lab 2 -> Physics 2

    // University Requirements
    15200106: ["15200099"], // English 1 -> Remedial English
    15200112: ["15200106"], // English 2 -> English 1
  };

  const isAi = majorId === "ai" || (majorName && majorName.includes("الذكاء"));
  let workingCourses = [...courses];
  if (isAi) {
    const existingCodeSet = new Set(
      workingCourses.map((c) => String(c.id || c.code)),
    );
    for (const aiCourse of AI_CURRICULUM_COURSES) {
      if (!existingCodeSet.has(aiCourse.id)) {
        workingCourses.push({
          ...aiCourse,
          status: "remaining",
        });
        existingCodeSet.add(aiCourse.id);
      }
    }
  }

  const courseCodesSet = new Set(
    workingCourses.map((c) => String(c.id || c.code)),
  );
  const aiCourseMap = new Map(AI_CURRICULUM_COURSES.map((c) => [c.id, c]));

  return workingCourses.map((c) => {
    const code = String(c.id || c.code);
    const existingPrereqs = Array.isArray(c.prerequisites)
      ? [...c.prerequisites]
      : [];
    const aiTemplate = aiCourseMap.get(code);

    const mapped = PREREQ_MAP[code] || aiTemplate?.prerequisites || [];
    for (const p of mapped) {
      if (courseCodesSet.has(p) && !existingPrereqs.includes(p)) {
        existingPrereqs.push(p);
      }
    }

    const cName = c.name || "";
    if (
      cName.includes("(2)") ||
      cName.includes(" 2") ||
      cName.includes("ثاني")
    ) {
      const baseName1 = cName.replace(/\(2\)| 2|ثاني|الثاني/g, "").trim();
      const p1 = workingCourses.find(
        (other) =>
          (other.id || other.code) !== code &&
          (other.name.includes(`${baseName1} (1)`) ||
            other.name.includes(`${baseName1} 1`) ||
            other.name.includes(`${baseName1} أول`) ||
            other.name.trim() === baseName1),
      );
      if (p1 && !existingPrereqs.includes(p1.id || p1.code)) {
        existingPrereqs.push(p1.id || p1.code);
      }
    }

    if (cName.includes("مختبر") || cName.includes("عملي")) {
      const baseLecture = cName.replace(/مختبر|عملي/g, "").trim();
      const lecture = workingCourses.find(
        (other) =>
          (other.id || other.code) !== code &&
          !other.name.includes("مختبر") &&
          !other.name.includes("عملي") &&
          other.name.includes(baseLecture),
      );
      if (lecture && !existingPrereqs.includes(lecture.id || lecture.code)) {
        existingPrereqs.push(lecture.id || lecture.code);
      }
    }

    let semester = c.semester || c.recommendedSemester || aiTemplate?.semester;
    if (!semester || !semester.includes("السنة")) {
      const level = code.length >= 6 ? parseInt(code.charAt(5), 10) : 1;
      const y = !isNaN(level) && level >= 1 && level <= 5 ? level : 1;
      const yearWord =
        [
          "السنة الأولى",
          "السنة الأولى",
          "السنة الثانية",
          "السنة الثالثة",
          "السنة الرابعة",
          "السنة الخامسة",
        ][y] || "السنة الأولى";

      const hasPrereqInSameYear = existingPrereqs.some((p) => {
        const pLevel = p.length >= 6 ? parseInt(p.charAt(5), 10) : 1;
        return pLevel === y;
      });
      const isSecondPart =
        cName.includes("(2)") ||
        cName.includes(" 2") ||
        cName.includes("ثاني") ||
        cName.includes("الثاني") ||
        cName.includes("مختبر") ||
        cName.includes("عملي");

      const isSem2 = hasPrereqInSameYear || isSecondPart;
      semester = `${yearWord} - ${isSem2 ? "الفصل الثاني" : "الفصل الأول"}`;
    }

    return {
      ...c,
      category: c.category || aiTemplate?.category || "متطلب تخصص إجباري",
      prerequisites: existingPrereqs,
      semester,
      recommendedSemester: semester,
    };
  });
}

const EDUGATE_LOGIN_URLS = [
  "https://edugate.ptuk.edu.ps/faces/ui/login.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/guest/login.xhtml",
];
const EDUGATE_STUDENT_URLS = [
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/index.xhtml",
  "https://edugate.ptuk.edu.ps/student",
];
const EDUGATE_TRANSCRIPT_URLS = [
  "https://edugate.ptuk.edu.ps/student/transcript",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/transcript/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/transcript.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/marks/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/academicRecord/index.xhtml",
];
const EDUGATE_MAJOR_PLAN_URLS = [
  "https://edugate.ptuk.edu.ps/student/majorPlan",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/majorPlan/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/plan/index.xhtml",
  "https://edugate.ptuk.edu.ps/student/plan",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/plan.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/studyPlan/index.xhtml",
  "https://edugate.ptuk.edu.ps/student/studyPlan",
];
const EDUGATE_EXEMPTION_EXAMS_URLS = [
  "https://edugate.ptuk.edu.ps/student/exemptionExams",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/exemptionExams/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/exemptionExams.xhtml",
];
const EDUGATE_TRANSACTIONS_URLS = [
  "https://edugate.ptuk.edu.ps/student/academicTransactions",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/academicTransactions/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/academicTransactions.xhtml",
];
const EDUGATE_FINANCIAL_URLS = [
  "https://edugate.ptuk.edu.ps/student/financialRecord",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/student/financialRecord/index.xhtml",
  "https://edugate.ptuk.edu.ps/faces/ui/pages/stu/financialRecord.xhtml",
];

async function navigateEdugateSection(
  page,
  { menuSelectors = [], urls = [], verifyFn = null, label = "", keywords = [] },
) {
  if (label) console.log(`🧭 جاري الانتقال إلى ${label}...`);

  // 1. Highest priority: Direct Pretty URL navigation (fast, deterministic, bypasses JSF UI tab states)
  for (const url of urls) {
    try {
      console.log(`🌐 محاولة الانتقال المباشر للرابط (${label}): ${url}`);
      const resp = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      if (resp && resp.status() < 400) {
        if (verifyFn) {
          let ok = await verifyFn(page);
          if (!ok) {
            await page.waitForTimeout(300);
            ok = await verifyFn(page);
          }
          if (ok) {
            console.log(
              `✅ تم الوصول وتأكيد الصفحة بنجاح عبر الرابط المباشر (${label}): ${url}`,
            );
            return true;
          }
        } else {
          const currentUrl = page.url();
          const pageOk = await page
            .evaluate(() => {
              const txt = (
                document.body?.innerText ||
                document.body?.textContent ||
                ""
              ).trim();
              if (
                txt.includes("404") ||
                txt.includes("Not Found") ||
                txt.includes("Error 500")
              )
                return false;
              const hasElements =
                document.querySelectorAll(
                  "table, .ui-datatable, .ui-treetable, .ui-panel, form",
                ).length > 0;
              return txt.length > 50 && hasElements;
            })
            .catch(() => false);

          if (pageOk && !currentUrl.includes("login.xhtml")) {
            console.log(
              `✅ تم الوصول بنجاح عبر الرابط المباشر (${label}): ${url}`,
            );
            return true;
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ فشل فتح الرابط المباشر ${url}: ${err.message}`);
    }
  }

  // 2. Second priority: Expand Barcelona sidebar layout and click menu selectors
  try {
    await page.evaluate(() => {
      document.querySelectorAll(".layout-tabmenu-content").forEach((el) => {
        el.classList.add("layout-tabmenu-content-active");
        el.style.display = "block";
      });
      document.querySelectorAll(".layout-wrapper").forEach((el) => {
        el.classList.add("layout-wrapper-menu-active");
      });
      const headers = document.querySelectorAll(
        '.ui-panelmenu-header:not(.ui-state-active), .layout-menu .menu-category-header, [data-widget="panelmenu"] h3',
      );
      headers.forEach((h) => {
        try {
          h.click();
        } catch {}
      });
    });
    await page.waitForTimeout(150);
  } catch {}

  const initialUrl = page.url();

  for (const selector of menuSelectors) {
    try {
      const loc = page.locator(selector).first();
      if ((await loc.count()) > 0) {
        console.log(
          `🔗 تجربة النقر على خيار القائمة لـ (${label}): ${selector}`,
        );
        await Promise.all([
          page
            .waitForLoadState("domcontentloaded", { timeout: 10000 })
            .catch(() => {}),
          loc.click({ timeout: 5000, force: true }).catch(() => {}),
        ]);
        await page
          .waitForSelector("table, .ui-datatable, .ui-treetable, form", {
            timeout: 1200,
          })
          .catch(() => {});
        if (verifyFn) {
          const ok = await verifyFn(page);
          if (ok) {
            console.log(
              `✅ تم تأكيد الوصول عبر النقر على القائمة لـ: ${label}`,
            );
            return true;
          }
        } else {
          const newUrl = page.url();
          const hasTable = await page
            .evaluate(
              () =>
                document.querySelectorAll("table, .ui-datatable, .ui-treetable")
                  .length > 0,
            )
            .catch(() => false);
          if (newUrl !== initialUrl || hasTable) {
            return true;
          }
        }
      }
    } catch {}
  }

  // 3. Third priority: Keyword matching inside DOM anchors/buttons
  if (keywords && keywords.length > 0) {
    try {
      const clicked = await page.evaluate((kws) => {
        const anchors = Array.from(
          document.querySelectorAll(
            'a, button, [role="menuitem"], .ui-menuitem-link',
          ),
        );
        for (const a of anchors) {
          const txt = (a.innerText || a.textContent || "").trim();
          if (kws.some((kw) => txt.includes(kw))) {
            let p = a.parentElement;
            while (p && p !== document.body) {
              if (p.style.display === "none") p.style.display = "";
              p = p.parentElement;
            }
            a.click();
            return txt;
          }
        }
        return null;
      }, keywords);

      if (clicked) {
        console.log(
          `🔗 تم النقر على رابط القائمة بالنص (${clicked}) لـ: ${label}`,
        );
        await page
          .waitForSelector("table, .ui-datatable, .ui-treetable, form", {
            timeout: 1200,
          })
          .catch(() => {});
        if (verifyFn) {
          const ok = await verifyFn(page);
          if (ok) return true;
        } else {
          const newUrl = page.url();
          const hasTable = await page
            .evaluate(
              () =>
                document.querySelectorAll("table, .ui-datatable, .ui-treetable")
                  .length > 0,
            )
            .catch(() => false);
          if (newUrl !== initialUrl || hasTable) {
            return true;
          }
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Extract 4-digit academic admission cohort year from student ID.
 * Handles PTUK 8-digit format (12214050 -> 2022, 12301234 -> 2023) and 9-digit format (202310123 -> 2023).
 */
function extractStudentCohortYear(id) {
  const currentYear = new Date().getFullYear();
  if (!id) return String(currentYear - 1);
  const s = String(id).trim();
  const fourDigitMatch = s.match(/\b(20\d{2})\b/);
  if (fourDigitMatch) return fourDigitMatch[1];
  const ptukMatch = s.match(/^1(2\d)/);
  if (ptukMatch) return String(2000 + parseInt(ptukMatch[1], 10));
  if (s.length >= 4 && /^\d{4}$/.test(s.substring(0, 4)))
    return s.substring(0, 4);
  return String(currentYear - 1);
}

/**
 * Generate complete curriculum and academic standing for a student cohort.
 * Used for instant demo mode and resilient offline fallback.
 *
 * @param {string} studentId - University student ID
 */
function buildCohortCurriculumAndProgress(studentId) {
  const normId = String(studentId || "").trim();
  const cohortYear = extractStudentCohortYear(normId);
  const numYear = parseInt(cohortYear, 10);
  const yearsCompleted = Math.max(
    0,
    Math.min(5, new Date().getFullYear() - numYear),
  );

  // Determine major accurately: check saved record or infer from normId
  const existingSaved = getStudentRecord(normId);
  let majorId = existingSaved?.majorId
    ? existingSaved.majorId.split("_")[0]
    : null;
  let majorName = existingSaved?.majorName || null;
  let college = existingSaved?.college || null;

  if (!majorId || !majorName) {
    const inferred = inferMajorFromCourses(
      existingSaved?.planCourses || [],
      normId,
    );
    majorId = inferred.id;
    majorName = inferred.name;
    college = inferred.college;
  }

  // Get cached cohort plan if already saved, or base major plan
  const existingCohortPlan = getMajorCohortPlan(majorId, cohortYear);
  const baseMajor = existingCohortPlan || getMajorById(majorId);

  const isCseMajor =
    majorId === "cse" ||
    (majorName.includes("أنظمة الحاسوب") && !majorName.includes("الذكاء"));
  let baseCourses = [];

  if (
    baseMajor &&
    Array.isArray(baseMajor.courses) &&
    baseMajor.courses.length > 0 &&
    (isCseMajor ||
      !baseMajor.courses.some((c) => (c.id || c.code) === "12110236"))
  ) {
    baseCourses = baseMajor.courses;
  } else if (isCseMajor) {
    baseCourses = extractCoursesFromDataTs();
  } else {
    // Artificial Intelligence & Modern IT Curriculum: 132 credit hours with full prerequisites and semester layout
    baseCourses = AI_CURRICULUM_COURSES;
  }

  const coursesWithStatus = baseCourses.map((course, index) => {
    let status = "remaining"; // "completed" | "registered" | "remaining" | "failed"
    let grade = null;

    // Remedial and placement courses (English 15200099, Computer 13010006)
    if (course.id === "15200099" || course.id === "13010006") {
      status = "completed";
      grade = 85;
    } else if (yearsCompleted >= 4 && index < 38) {
      status = "completed";
      grade = 70 + (index % 25);
    } else if (yearsCompleted >= 3 && index < 28) {
      status = "completed";
      grade = 68 + (index % 28);
    } else if (yearsCompleted >= 2 && index < 20) {
      status = "completed";
      grade = 72 + (index % 24);
    } else if (yearsCompleted >= 1 && index < 12) {
      status = "completed";
      grade = 75 + (index % 20);
    } else if (yearsCompleted >= 1 && index >= 12 && index < 17) {
      status = "registered";
    } else if (yearsCompleted === 0 && index < 6) {
      status = "registered";
    }

    return {
      id: course.id,
      code: course.id,
      name: course.name,
      credits: course.credits,
      category: course.category,
      prerequisites: course.prerequisites || [],
      coPrerequisites: course.coPrerequisites || [],
      semester: course.semester,
      recommendedSemester: course.recommendedSemester || course.semester,
      seasonal: course.seasonal || "both",
      status,
      grade,
    };
  });

  const completedCourses = coursesWithStatus.filter(
    (c) => c.status === "completed",
  );
  const registeredCourses = coursesWithStatus.filter(
    (c) => c.status === "registered",
  );
  const remainingCourses = coursesWithStatus.filter(
    (c) => c.status === "remaining",
  );

  const courseGrades = {};
  for (const c of completedCourses) {
    if (typeof c.grade === "number") {
      courseGrades[c.id] = c.grade;
    }
  }

  // Exclude remedial courses (English 15200099, Computer 13010006) from earned degree credits
  const earnedCredits = completedCourses.reduce((sum, c) => {
    if (isRemedialCourseCode(c.id, c.name, c.category)) return sum;
    return sum + (c.credits || 0);
  }, 0);

  // Clean General Curriculum Courses (without student marks or completion flags)
  const cleanGeneralCourses = coursesWithStatus.map((c) => ({
    id: c.id,
    code: c.code || c.id,
    name: c.name,
    credits: Number(c.credits) || 3,
    category: c.category || "متطلب تخصص إجباري",
    prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
    coPrerequisites: Array.isArray(c.coPrerequisites) ? c.coPrerequisites : [],
    seasonal: c.seasonal || "both",
  }));

  const cleanMajorKey = `${slugifyMajor(majorName)}_${cohortYear}`;
  const isDiploma = Boolean(
    (college && (college.includes("دبلوم") || college.includes("متوسطة"))) ||
    (majorName && majorName.includes("دبلوم")),
  );
  const isMaster = Boolean(
    (college && college.includes("دراسات عليا")) ||
    (majorName &&
      (majorName.includes("ماجستير") || majorName.includes("Master"))),
  );
  const isFiveYear = Boolean(
    college &&
    college.includes("هندسة") &&
    !majorName.includes("الذكاء") &&
    !majorName.includes("علم الحاسوب"),
  );
  const degreeCredits = isDiploma ? 72 : isMaster ? 36 : isFiveYear ? 164 : 132;
  const resolvedDegree = isDiploma
    ? "دبلوم متوسط"
    : isMaster
      ? "ماجستير"
      : "بكالوريوس";

  // Calculate category requirements:
  // For compulsory categories, sum compulsory course hours.
  // For elective categories, use standard curriculum caps (never sum the entire pool of elective choices).
  const calculatedCategoryReqs = {};
  for (const c of cleanGeneralCourses) {
    const cat = c.category || "متطلب تخصص إجباري";
    if (!cat.includes("اختياري")) {
      calculatedCategoryReqs[cat] =
        (calculatedCategoryReqs[cat] || 0) + (c.credits || 0);
    }
  }

  // Set standard caps for elective categories:
  if (
    cleanGeneralCourses.some((c) => c.category?.includes("متطلب جامعة اختياري"))
  ) {
    calculatedCategoryReqs["متطلب جامعة اختياري"] = isFiveYear ? 6 : 9;
  }
  if (
    cleanGeneralCourses.some((c) => c.category?.includes("متطلب تخصص اختياري"))
  ) {
    calculatedCategoryReqs["متطلب تخصص اختياري"] = isFiveYear ? 15 : 9;
  }
  if (
    cleanGeneralCourses.some((c) => c.category?.includes("متطلب كلية اختياري"))
  ) {
    calculatedCategoryReqs["متطلب كلية اختياري"] = 3;
  }

  // Total degree credits is the sum of non-remedial category requirements
  let calculatedTotalCredits = Object.entries(calculatedCategoryReqs).reduce(
    (sum, [cat, cr]) => {
      if (cat.includes("استدراكي")) return sum;
      return sum + cr;
    },
    0,
  );

  const minValidCr = isDiploma ? 60 : isMaster ? 30 : 120;
  const maxValidCr = isDiploma ? 90 : isMaster ? 45 : 175;
  if (
    calculatedTotalCredits < minValidCr ||
    calculatedTotalCredits > maxValidCr
  ) {
    calculatedTotalCredits = degreeCredits;
  }

  const cleanMajorRecord = {
    id: cleanMajorKey,
    code: cleanMajorKey,
    name: majorName,
    cohortYear,
    displayName: `${majorName} - دفعة ${cohortYear}`,
    college:
      college ||
      baseMajor?.college ||
      (isFiveYear
        ? "كلية الهندسة والتكنولوجيا"
        : "كلية تكنولوجيا المعلومات والاتصالات"),
    degree: resolvedDegree,
    totalCredits: calculatedTotalCredits,
    categoryRequirements: calculatedCategoryReqs,
    description: `الخطة الاسترشادية العامة لتخصص ${majorName} (دفعة ${cohortYear})`,
    courses: cleanGeneralCourses,
    updatedAt: new Date().toISOString(),
  };

  upsertMajor(cleanMajorRecord);
  saveMajorCohortPlan(cleanMajorKey, cohortYear, cleanMajorRecord);

  const gpa =
    completedCourses.length > 0
      ? (
          completedCourses.reduce((sum, c) => {
            if (isRemedialCourseCode(c.id, c.name, c.category)) return sum;
            return sum + (c.grade || 75) * c.credits;
          }, 0) / Math.max(1, earnedCredits)
        ).toFixed(1)
      : "0.0";

  const enrolledCourses = registeredCourses.map((c, idx) => ({
    code: c.id,
    name: c.name,
    sec: String((idx % 3) + 1),
    blocks: [
      {
        days:
          idx % 2 === 0
            ? ["الأحد", "الثلاثاء", "الخميس"]
            : ["الاثنين", "الأربعاء"],
        start: 8.5 + (idx % 4),
        end: 9.5 + (idx % 4),
        rawTime: idx % 2 === 0 ? "08:30-09:30 أح ثلا خمـ" : "09:30-11:00 اث ار",
      },
    ],
  }));

  // Group completed courses into structured semesters per cohort timeline
  const structuredSemesters = [];
  if (completedCourses.length > 0) {
    const terms = [
      `الفصل الأول ${numYear}/${numYear + 1}`,
      `الفصل الثاني ${numYear}/${numYear + 1}`,
      `الفصل الأول ${numYear + 1}/${numYear + 2}`,
      `الفصل الثاني ${numYear + 1}/${numYear + 2}`,
      `الفصل الأول ${numYear + 2}/${numYear + 3}`,
      `الفصل الثاني ${numYear + 2}/${numYear + 3}`,
      `الفصل الأول ${numYear + 3}/${numYear + 4}`,
      `الفصل الثاني ${numYear + 3}/${numYear + 4}`,
    ];

    const chunkSize = 6;
    for (let i = 0; i < completedCourses.length; i += chunkSize) {
      const termIdx = Math.floor(i / chunkSize);
      const termTitle = terms[termIdx] || `الفصل الدراسي ${termIdx + 1}`;
      const chunk = completedCourses.slice(i, i + chunkSize).map((c, cIdx) => ({
        code: c.id,
        name: c.name,
        credits: c.credits || 3,
        grade: c.grade || 76 + ((i + cIdx) % 18),
        status: "ناجح",
        isPassed: true,
        isRegistered: false,
        isFailed: false,
      }));
      structuredSemesters.push({
        title: termTitle,
        courses: chunk,
      });
    }

    structuredSemesters.sort(
      (a, b) => parseSemesterWeight(b.title) - parseSemesterWeight(a.title),
    );
  }

  return {
    studentId: normId,
    studentName: "طالب تجريبي",
    cohortYear,
    majorId: cleanMajorKey,
    majorName,
    college: cleanMajorRecord.college,
    degree: resolvedDegree,
    academicStatus: "منتظم",
    academicAdvisor: "غير محدد (وضع العرض)",
    academicWarning: "لا يوجد",
    currentSemester: `الفصل الثاني ${numYear + Math.max(0, yearsCompleted - 1)}/${numYear + Math.max(1, yearsCompleted)}`,
    financialBalance: "0 دائن",
    earnedCredits,
    totalCredits: calculatedTotalCredits || degreeCredits,
    gpa: parseFloat(gpa),
    courseGrades,
    planCourses: coursesWithStatus,
    passedCourseIds: completedCourses.map((c) => c.id),
    registeredCourseIds: registeredCourses.map((c) => c.id),
    remainingCourseIds: remainingCourses.map((c) => c.id),
    failedCourseIds: [],
    categoryRequirements:
      baseMajor?.categoryRequirements &&
      Object.keys(baseMajor.categoryRequirements).length > 0
        ? baseMajor.categoryRequirements
        : calculatedCategoryReqs,
    enrolledCourses,
    semesters: structuredSemesters,
    transactions: [],
    financial: {
      balance: "0 دائن",
      currency: "دينار أردني (JOD)",
      totalDebit: 0,
      totalCredit: 0,
      payments: [],
    },
    exemptionExams: [
      {
        code: "15200099",
        name: "إنجليزي إستدراكي",
        status: "معفى/ناجح",
        grade: null,
        isPassed: true,
      },
      {
        code: "13010006",
        name: "مهارات الحاسوب وتطبيقاته",
        status: "معفى/ناجح",
        grade: null,
        isPassed: true,
      },
    ],
    isLiveEdugate: false,
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * Parses scraped exemption and placement exam rows from Edugate PTUK.
 * Handles single or multiple comma-separated course codes in the "المقررات المعفاة" column
 * (e.g. "15200099,15200106" for English level exam exempting both Remedial English and English 1).
 *
 * @param {Array<object>} scrapedExams - Extracted table rows with metadata
 * @returns {{ exemptionExams: Array<object>, passedCourseCodes: Set<string> }}
 */
export function parseExemptionExamRows(scrapedExams) {
  const exemptionExams = [];
  const passedCourseCodes = new Set();

  if (!Array.isArray(scrapedExams)) {
    return { exemptionExams, passedCourseCodes };
  }

  for (const item of scrapedExams) {
    const rowText = item.text || (item.cells || []).join(" ");
    if (
      (rowText.includes("رمز المقرر") && rowText.includes("اسم المقرر")) ||
      (rowText.includes("اسم الامتحان") && rowText.includes("النتيجة")) ||
      (rowText.includes("الامتحان") && rowText.includes("المقررات المعفاة"))
    ) {
      continue;
    }

    const examName = (item.examName || item.cells?.[0] || "").trim();
    const semester = (item.semester || item.cells?.[1] || "").trim();
    const exemptedRaw = (item.exemptedCoursesRaw || "").trim();
    const passedRaw = (item.passedRaw || "").trim();

    // Extract potential exam grade from cells or item.grade first
    let examGrade = null;
    if (typeof item.grade === "number" && !isNaN(item.grade)) {
      examGrade = item.grade;
    } else {
      for (const c of item.cells || []) {
        const trimmedCell = String(c).trim();
        const n = parseFloat(trimmedCell);
        if (
          !isNaN(n) &&
          n >= 0 &&
          n <= 100 &&
          trimmedCell.length <= 5 &&
          !/^\d{6,8}$/.test(trimmedCell)
        ) {
          examGrade = n;
          break;
        }
      }
    }

    const isExplicitFail =
      Boolean(item.hasCloseIcon) ||
      (examGrade !== null && examGrade < 50) ||
      /(راسب|غير معفى|غير مجتاز|فشل|fail|no|\bلا\b)/i.test(passedRaw) ||
      /(راسب|غير معفى|غير مجتاز)/i.test(rowText);

    // Extract all 6-to-8 digit course codes
    let foundCodes = [];
    if (exemptedRaw) {
      const matches = exemptedRaw.match(/\b\d{6,8}\b/g);
      if (matches) foundCodes.push(...matches);
    }
    if (foundCodes.length === 0) {
      // Look across cells for 6-8 digit course codes
      const matches = rowText.match(/\b\d{6,8}\b/g);
      if (matches) {
        foundCodes.push(...matches);
      }
    }

    // Deduplicate
    foundCodes = Array.from(new Set(foundCodes));

    const isEnglishExam =
      examName.includes("انجليزي") ||
      examName.includes("إنجليزية") ||
      examName.includes("English") ||
      rowText.includes("انجليزي") ||
      rowText.includes("إنجليزية") ||
      rowText.includes("English") ||
      foundCodes.some((c) => c === "15200099" || c === "15200106");

    const isComputerExam =
      examName.includes("حاسوب") ||
      examName.includes("Computer") ||
      rowText.includes("حاسوب") ||
      rowText.includes("Computer") ||
      foundCodes.includes("13010006");

    const isArabicExam =
      examName.includes("عربي") ||
      examName.includes("عربية") ||
      examName.includes("Arabic") ||
      rowText.includes("عربي") ||
      rowText.includes("عربية") ||
      rowText.includes("Arabic") ||
      foundCodes.includes("15200098");

    const hasExplicitEnglish1 =
      /(?:لغة\s+إ?نجليزي[ةه]\s*\(?1\)?|إ?نجليزي\s*\(?1\)?|\bEnglish\s*1\b)(?!\d)/i.test(
        rowText,
      ) ||
      /(?:لغة\s+إ?نجليزي[ةه]\s*\(?1\)?|إ?نجليزي\s*\(?1\)?|\bEnglish\s*1\b)(?!\d)/i.test(
        exemptedRaw,
      );

    const hasExplicitEnglish2 =
      /(?:لغة\s+إ?نجليزي[ةه]\s*\(?2\)?|إ?نجليزي\s*\(?2\)?|\bEnglish\s*2\b)(?!\d)/i.test(
        rowText,
      ) ||
      /(?:لغة\s+إ?نجليزي[ةه]\s*\(?2\)?|إ?نجليزي\s*\(?2\)?|\bEnglish\s*2\b)(?!\d)/i.test(
        exemptedRaw,
      );

    // PTUK Placement Exam Regulations:
    // - English Placement:
    //     Grade >= 80: Exempts BOTH Remedial English (15200099) AND English 1 (15200106).
    //     Grade 50-79: Exempts Remedial English (15200099). Student must take English 1 (15200106).
    //     Grade < 50: Fails placement test. Student must register Remedial English (15200099).
    if (isEnglishExam && !isExplicitFail) {
      if ((examGrade !== null && examGrade >= 80) || hasExplicitEnglish1) {
        if (!foundCodes.includes("15200106")) foundCodes.push("15200106");
        if (!foundCodes.includes("15200099")) foundCodes.unshift("15200099");
      } else if (foundCodes.length === 0) {
        foundCodes.push("15200099");
      }
    }

    if (hasExplicitEnglish2 && !isExplicitFail) {
      if (!foundCodes.includes("15200112")) foundCodes.push("15200112");
      if (!foundCodes.includes("15200106")) foundCodes.push("15200106");
      if (!foundCodes.includes("15200099")) foundCodes.unshift("15200099");
    }

    // If no course code was found in the text, fallback to default exam codes:
    if (foundCodes.length === 0) {
      if (isEnglishExam) foundCodes.push("15200099");
      else if (isComputerExam) foundCodes.push("13010006");
      else if (isArabicExam) foundCodes.push("15200098");
      else {
        const anyCode = (item.cells || []).find((c) =>
          /^\d{6,8}$/.test(c.trim()),
        );
        if (anyCode) foundCodes.push(anyCode.trim());
      }
    }

    // Determine pass / exemption status:
    // If courses are listed in "المقررات المعفاة" and not explicitly failed,
    // or if check icon is present, or if passed text indicates pass,
    // or if grade is >= 50.
    const hasExemptionList = Boolean(exemptedRaw && foundCodes.length > 0);
    const isPassedOrExempt =
      !isExplicitFail &&
      (Boolean(item.hasCheckIcon) ||
        hasExemptionList ||
        (examGrade !== null && examGrade >= 50) ||
        /(معفى|معفاة|ناجح|اجتياز|محتسب|معادل|نعم|pass|exempt|yes)/i.test(
          passedRaw,
        ) ||
        /(معفى|معفاة|ناجح|اجتياز|محتسب|معادل|pass|exempt)/i.test(rowText) ||
        (item.cells || []).some((cell) => {
          const num = parseFloat(cell);
          return (
            !isNaN(num) &&
            num >= 50 &&
            num <= 100 &&
            !foundCodes.includes(cell.trim())
          );
        }));

    // If English placement exam exempted English 1 (15200106), ensure English Remedial (15200099) is also included
    if (foundCodes.includes("15200106") && !foundCodes.includes("15200099")) {
      foundCodes.unshift("15200099");
    }

    for (const code of foundCodes) {
      let courseName = "";
      if (code === "15200099") courseName = "إنجليزي إستدراكي";
      else if (code === "15200106") courseName = "اللغة الإنجليزية (1)";
      else if (code === "15200112") courseName = "اللغة الإنجليزية (2)";
      else if (code === "13010006") courseName = "مهارات الحاسوب وتطبيقاته";
      else if (code === "15200098") courseName = "لغة عربية إستدراكية";
      else if (code === "15200102") courseName = "اللغة العربية";
      else if (code === "15200103") courseName = "مهارات اللغة العربية";
      else courseName = `مساق ${code}`;

      const resolvedExamName =
        examName ||
        (isEnglishExam
          ? "امتحان مستوى انجليزي"
          : isComputerExam
            ? "امتحان مهارات حاسوب"
            : isArabicExam
              ? "امتحان مستوى عربي"
              : "امتحان مستوى");

      const isHighScoreEnglishExemption =
        code === "15200106" &&
        ((examGrade !== null && examGrade >= 80) ||
          !exemptedRaw?.includes("15200106"));

      const statusDesc = isPassedOrExempt
        ? code === "15200106"
          ? examGrade !== null && examGrade >= 80
            ? "معفى/ناجح (تفوق امتحان مستوى ≥ 80)"
            : "معفى/ناجح (إعفاء مستوى)"
          : "معفى/ناجح"
        : "غير معفى/راسب";

      exemptionExams.push({
        code,
        name: courseName,
        examName: resolvedExamName,
        semester: semester || undefined,
        status: statusDesc,
        grade: examGrade,
        isPassed: isPassedOrExempt,
        rawText: rowText,
      });

      if (isPassedOrExempt) {
        passedCourseCodes.add(code);
      }
    }
  }

  return { exemptionExams, passedCourseCodes };
}

let sharedBrowser = null;

async function getSharedBrowser() {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return sharedBrowser;
}

export async function closeSharedBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {}
    sharedBrowser = null;
  }
}

/**
 * Authenticates against PTUK Edugate and synchronizes student's complete academic record,
 * including profile metadata, advisor, GPA, full transcript by semester,
 * current registered courses, and major plan progress.
 *
 * @param {string} studentId - الرقم الجامعي أو اسم المستخدم
 * @param {string} password - كلمة مرور بوابة خضوري
 * @param {object} [options]
 */
export async function authenticateAndSyncStudent(
  studentId,
  password,
  options = {},
) {
  const normId = String(studentId || "").trim();
  const rawPassword = String(password || "").trim();

  if (!normId) {
    throw new Error("يرجى إدخال الرقم الجامعي للطالب.");
  }

  const cohortYear = extractStudentCohortYear(normId);

  // Support demo / offline credentials
  if (
    options.demoMode ||
    normId === "demo" ||
    normId.startsWith("demo_") ||
    rawPassword === "demo" ||
    !rawPassword
  ) {
    const data = buildCohortCurriculumAndProgress(normId);
    saveStudentRecord(normId, data);
    return data;
  }

  // ─── 0-Second Fast Cached Authentication ───────────────────────
  // If the student has previously logged in and we have their verified record + password hash,
  // we verify credentials instantly in 0ms without launching a 20-second Playwright session!
  if (!options.forceLive && rawPassword) {
    const existing = getStudentRecord(normId);
    if (
      existing &&
      existing.authHash &&
      verifyStudentPassword(rawPassword, existing.authHash)
    ) {
      console.log(
        `⚡ [FAST CACHE] استرجاع فوري لسجل الطالب (${normId}) من الكاش (0 ثوانٍ).`,
      );
      return {
        ...existing,
        fromCache: true,
      };
    }
  }

  let context;
  let page;

  try {
    console.log(
      `🔐 محاولة تسجيل الدخول للطالب (${normId}) عبر بوابة خضوري Edugate...`,
    );
    const browser = await getSharedBrowser();
    context = await browser.newContext();

    // Block heavy non-essential assets (images, fonts, media) across the entire session to accelerate scraping by 3x-5x
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") {
        return route.abort();
      }
      return route.continue();
    });

    page = await context.newPage();

    // 1. Go to Edugate login page (try candidate URLs)
    let loginLoaded = false;
    for (const loginUrl of EDUGATE_LOGIN_URLS) {
      try {
        const resp = await page.goto(loginUrl, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
        if (resp && resp.status() < 400) {
          loginLoaded = true;
          break;
        }
      } catch {}
    }

    if (!loginLoaded) {
      await page.goto(EDUGATE_LOGIN_URLS[0], {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    }

    const userField = page
      .locator(
        'input[type="text"]:visible, input[name*="j_idt17"], input[name*="user"], input[id*="username"], input[name*="username"]',
      )
      .first();
    const passField = page
      .locator(
        'input[type="password"]:visible, input[name*="j_idt21"], input[id*="password"], input[name*="password"]',
      )
      .first();
    const submitButton = page
      .locator(
        'input[type="submit"]:visible, button[type="submit"]:visible, .ui-button:visible, button:has-text("دخول"), button:has-text("تسجيل الدخول")',
      )
      .first();

    if ((await passField.count()) > 0) {
      await userField.fill(normId);
      await passField.fill(rawPassword);

      await Promise.all([
        page
          .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 })
          .catch(() => {}),
        submitButton.click(),
      ]);

      await page
        .waitForSelector(
          '.topbar-username, .user-name, input[type="password"]:visible, .ui-growl-message, .layout-topbar, table, .layout-wrapper',
          { timeout: 3000 },
        )
        .catch(() => {});

      // Check for login failure
      if ((await page.locator('input[type="password"]:visible').count()) > 0) {
        const errorMsg = await page
          .locator(
            ".ui-growl-title, .ui-growl-message, .ui-messages-error, .alert-danger, .error, .ui-messages-error-summary",
          )
          .first()
          .textContent()
          .catch(() => null);

        throw new Error(
          errorMsg?.trim() ||
            "بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو الرقم الجامعي وكلمة المرور.",
        );
      }
    }

    console.log(
      "✅ تم تسجيل الدخول بنجاح! جاري سحب بيانات الملف الشخصي والسجل الأكاديمي...",
    );

    // 2. Extract Student Metadata from Landing Page (/student)
    const domMetadata = await page
      .evaluate(() => {
        function cleanText(t) {
          if (!t) return "";
          return t
            .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
            .trim();
        }
        const data = {};

        // 1. Topbar / user profile header
        const topbarEl = document.querySelector(
          ".layout-topbar .topbar-username, .user-name, .profile-name, #profile-menu, .layout-topbar-profile, .topbar-profile, .profile-name span, .user-display-name",
        );
        if (topbarEl) {
          const val = cleanText(topbarEl.textContent || "");
          if (
            val &&
            !val.includes("رقم") &&
            !val.includes("الكلية") &&
            val.length >= 3
          ) {
            data.studentName = val;
          }
        }

        const els = Array.from(
          document.querySelectorAll("td, th, span, label, div, p, strong, b"),
        );
        for (let i = 0; i < els.length; i++) {
          const txt = cleanText(els[i].innerText || els[i].textContent || "");
          if (/^(الرقم الجامعي|رقم الطالب|Student ID)[:：]?$/i.test(txt)) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.studentId = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (
            !data.studentName &&
            /^(اسم الطالب|الاسم|الطالب|Student Name)[:：]?$/i.test(txt)
          ) {
            for (let j = 1; j <= 3 && i + j < els.length; j++) {
              const val = cleanText(
                els[i + j].innerText || els[i + j].textContent || "",
              );
              if (
                val &&
                val.length >= 3 &&
                !val.includes("رقم") &&
                !val.includes("الكلية") &&
                !val.includes("التخصص") &&
                !/^\d+$/.test(val)
              ) {
                data.studentName = val;
                break;
              }
            }
          }
          if (
            /^(التخصص|البرنامج|Major|البرنامج الأكاديمي|التخصص الرئيسي)[:：]?$/i.test(
              txt,
            )
          ) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.majorName = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (/^(الكلية|Faculty|College)[:：]?$/i.test(txt)) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.college = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (
            /^(المرشد الأكاديمي|المرشد الاكاديمي|المرشد|Advisor)[:：]?$/i.test(
              txt,
            )
          ) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.advisor = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (/^(الرصيد|الرصيد المالي|Balance)[:：]?$/i.test(txt)) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.balance = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (/^(الحالة|الوضع الأكاديمي|Status)[:：]?$/i.test(txt)) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.academicStatus = cleanText(
                next.innerText || next.textContent || "",
              );
          }
          if (/^(الدرجة|الدرجة العلمية|Degree)[:：]?$/i.test(txt)) {
            const next = els[i].nextElementSibling || els[i + 1];
            if (next)
              data.degree = cleanText(next.innerText || next.textContent || "");
          }
        }
        return data;
      })
      .catch(() => ({}));

    const landingRaw = await page
      .evaluate(() => document.body.innerText)
      .catch(() => "");
    const landingText = normalizeDigitsAndText(landingRaw);

    const studentIdMatch = landingText.match(
      /(?:رقم الطالب|الرقم الجامعي|Student ID)\s*[:：\n\r\t]*(\d{7,10})/i,
    );
    let actualStudentId =
      domMetadata.studentId || (studentIdMatch ? studentIdMatch[1] : normId);
    let resolvedCohort = extractStudentCohortYear(
      actualStudentId || normId || cohortYear,
    );

    const cleanStudentName = (str) => {
      if (!str) return "";
      let s = String(str).replace(/[:：]/g, " ").trim();
      s = s.replace(/^(اسم الطالب|الطالب|الاسم|Student Name)\s*/i, "").trim();
      s = s
        .split(
          /(?:رقم الطالب|الرقم الجامعي|الكلية|التخصص|Student ID|\d{7,10})/i,
        )[0]
        .trim();
      if (
        s.includes("رقم") ||
        s.includes("الكلية") ||
        s.includes("التخصص") ||
        /^\d+$/.test(s) ||
        s.length < 3
      ) {
        return "";
      }
      return s;
    };

    let studentName = cleanStudentName(domMetadata.studentName);
    if (!studentName) {
      const studentNameMatch = landingText.match(
        /(?:اسم الطالب|الاسم|الطالب|Student Name)\s*[:：\s]*([^\n\r\t:]{3,60}?)(?=\s*(?:رقم الطالب|الرقم الجامعي|الكلية|التخصص|Student ID|رقم|\d{7,10}|$))/i,
      );
      if (studentNameMatch) {
        studentName = cleanStudentName(studentNameMatch[1]);
      }
    }
    if (!studentName) {
      const greetingMatch = landingText.match(
        /(?:مرحباً|مرحبا|أهلاً|اهلا)\s*(?:بك)?\s*([^\n\r\t:،,]{3,50})/i,
      );
      if (greetingMatch) {
        studentName = cleanStudentName(greetingMatch[1]);
      }
    }

    const currentSemesterMatch = landingText.match(
      /(?:الفصل الدراسي|الفصل الحالي|Semester)\s*[:：\n\r\t]*([^\n\r\t]{3,50})/i,
    );
    const now = new Date();
    const calYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const defaultTermName =
      month >= 2 && month <= 5
        ? "الفصل الثاني"
        : month >= 6 && month <= 8
          ? "الفصل الصيفي"
          : "الفصل الأول";
    const defaultAcadYear =
      month >= 8 ? `${calYear}/${calYear + 1}` : `${calYear - 1}/${calYear}`;
    const dynamicFallbackSemester = `${defaultTermName} ${defaultAcadYear}`;
    const currentSemester = currentSemesterMatch
      ? currentSemesterMatch[1].trim()
      : dynamicFallbackSemester;

    const collegeMatch = landingText.match(
      /(?:الكلية|Faculty|College)\s*[:：\n\r\t]*([^\n\r\t]{3,60})/i,
    );
    let college =
      domMetadata.college || (collegeMatch ? collegeMatch[1].trim() : "");

    const majorMatch = landingText.match(
      /(?:التخصص|البرنامج|البرنامج الأكاديمي|Major)\s*[:：\n\r\t]*([^\n\r\t]{3,60})/i,
    );
    let majorName =
      domMetadata.majorName || (majorMatch ? majorMatch[1].trim() : "");

    const statusMatch = landingText.match(
      /(?:الحالة|الوضع الأكاديمي|Status)\s*[:：\n\r\t]*([^\n\r\t]{2,30})/i,
    );
    const academicStatus =
      domMetadata.academicStatus ||
      (statusMatch ? statusMatch[1].trim() : "منتظم");

    const advisorMatch = landingText.match(
      /(?:المرشد الأكاديمي|المرشد الاكاديمي|المرشد|Advisor)\s*[:：\n\r\t]*([^\n\r\t]{2,50})/i,
    );
    const academicAdvisor =
      domMetadata.advisor || (advisorMatch ? advisorMatch[1].trim() : "");

    const balanceMatch = landingText.match(
      /(?:الرصيد|الرصيد المالي|Balance)\s*[:：\n\r\t]*([^\n\r\t]{1,30})/i,
    );
    const financialBalance =
      domMetadata.balance || (balanceMatch ? balanceMatch[1].trim() : "");

    const warningMatch = landingText.match(
      /(?:حالة الإنذار|حالة الانذار|الإنذار الأكاديمي|الانذار الأكاديمي|Warning)\s*[:：\n\r\t]*([^\n\r\t]{2,30})/i,
    );
    let academicWarning = warningMatch ? warningMatch[1].trim() : "لا يوجد";

    const degreeMatch = landingText.match(
      /(?:الدرجة العلمية|الدرجة|Degree)\s*[:：\n\r\t]*([^\n\r\t]{3,30})/i,
    );
    let scrapedDegree =
      domMetadata.degree || (degreeMatch ? degreeMatch[1].trim() : "");

    // 3. Scrape Full Transcript
    await navigateEdugateSection(page, {
      urls: EDUGATE_TRANSCRIPT_URLS,
      menuSelectors: [
        'a:has-text("السجل الأكاديمي")',
        'a:has-text("كشف العلامات")',
        'a:has-text("السجل")',
        'span:has-text("السجل الأكاديمي")',
        '.ui-menuitem-link:has-text("السجل")',
        'a[href*="transcript"]',
        'a[href*="marks"]',
      ],
      verifyFn: async (p) => {
        return await p
          .evaluate(() => {
            const txt =
              (document.body?.innerText || "") +
              (document.body?.textContent || "");
            const hasTables =
              document.querySelectorAll("table, .ui-datatable").length > 0;
            return (
              (txt.includes("السجل") ||
                txt.includes("العلامات") ||
                txt.includes("المعدل") ||
                txt.includes("المقرر") ||
                txt.includes("الساعات")) &&
              hasTables
            );
          })
          .catch(() => false);
      },
      label: "السجل الأكاديمي وكشف العلامات",
    });

    // Expand transcript containers and trigger view if needed
    await page
      .evaluate(() => {
        document
          .querySelectorAll(
            ".ui-accordion-content, .ui-panel-content, .ui-datatable-data",
          )
          .forEach((el) => {
            el.style.display = "block";
            el.style.visibility = "visible";
          });
        document
          .querySelectorAll(
            ".ui-accordion-header:not(.ui-state-active), .ui-fieldset-toggler",
          )
          .forEach((h) => {
            try {
              h.click();
            } catch {}
          });
        if (
          document.querySelectorAll("table tbody tr, table tr").length === 0
        ) {
          const showBtn = Array.from(
            document.querySelectorAll(
              "button, input[type='submit'], .ui-button",
            ),
          ).find((b) => {
            const t = (b.textContent || b.innerText || b.value || "").trim();
            return t === "عرض" || t === "بحث" || t.includes("عرض السجل");
          });
          if (showBtn) {
            try {
              showBtn.click();
            } catch {}
          }
        }
      })
      .catch(() => {});
    await page.waitForTimeout(300);

    const transcriptRawText = await page
      .evaluate(
        () =>
          (document.body.innerText || "") +
          "\n" +
          (document.body.textContent || ""),
      )
      .catch(() => "");
    const transcriptFullText = normalizeDigitsAndText(transcriptRawText);

    // Extract student name, ID, and major from transcript header if not found on landing page
    if (!studentName) {
      const transNameMatch = transcriptFullText.match(
        /(?:اسم الطالب|الاسم|الطالب|Student Name)\s*[:：\s]*([^\n\r\t:]{3,60}?)(?=\s*(?:رقم الطالب|الرقم الجامعي|الكلية|التخصص|Student ID|رقم|\d{7,10}|$))/i,
      );
      if (transNameMatch) {
        studentName = cleanStudentName(transNameMatch[1]);
      }
    }
    if (!actualStudentId || !/^\d{7,10}$/.test(actualStudentId)) {
      const transIdMatch = transcriptFullText.match(
        /(?:الرقم الجامعي|رقم الطالب|Student ID)\s*[:：\n\r\t]*(\d{7,10})/i,
      );
      if (transIdMatch) {
        actualStudentId = transIdMatch[1].trim();
        resolvedCohort = extractStudentCohortYear(actualStudentId);
      }
    }
    if (!majorName) {
      const transMajorMatch = transcriptFullText.match(
        /(?:التخصص|البرنامج|البرنامج الأكاديمي)\s*[:：\n\r\t]*([^\n\r\t]{3,60})/i,
      );
      if (transMajorMatch) {
        majorName = transMajorMatch[1].trim();
      }
    }
    if (!college) {
      const transColMatch = transcriptFullText.match(
        /(?:الكلية|Faculty|College)\s*[:：\n\r\t]*([^\n\r\t]{3,60})/i,
      );
      if (transColMatch) {
        college = transColMatch[1].trim();
      }
    }

    const gpaMatch = transcriptFullText.match(
      /(?:المعدل\s*التراكمي|المعدل\s*العام|مجموع\s*المعدل|Cumulative\s*GPA|GPA)\s*[:：]?\s*%?\s*([\d.]+)/i,
    );
    let parsedGpa = gpaMatch ? parseFloat(gpaMatch[1]) : null;

    const transcriptWarningMatch = transcriptFullText.match(
      /(?:حالة\s*الإنذار|حالة\s*الانذار|الإنذار)\s*[:：]?\s*([^\n\r\t]+)/i,
    );
    if (transcriptWarningMatch) {
      academicWarning = transcriptWarningMatch[1].trim();
    }

    // Extract all semester tables with dynamic column detection
    const semesterTables = await page.evaluate(() => {
      function norm(str) {
        if (!str) return "";
        return str
          .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
          .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
          .trim();
      }

      function cleanCell(el) {
        if (!el) return "";
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "th") {
          return norm(el.textContent || el.innerText || "").trim();
        }
        const clone = el.cloneNode(true);
        clone
          .querySelectorAll(".ui-column-title, script, style")
          .forEach((c) => c.remove());
        return norm(clone.textContent || clone.innerText || "").trim();
      }

      const results = [];
      const tables = Array.from(document.querySelectorAll("table")).filter(
        (t) => !t.parentElement?.closest("table"),
      );

      for (const table of tables) {
        const headerCells = Array.from(
          table.querySelectorAll(
            "th, thead td, tr.ui-state-default th, tr.ui-widget-header th, tr:first-child th",
          ),
        );
        const headers = headerCells.map((th) => cleanCell(th).toLowerCase());

        const trs = Array.from(table.querySelectorAll("tbody tr, tr"));
        if (trs.length === 0) continue;

        // Locate semester title from captions, header rows, fieldsets/legends, or preceding elements
        let semesterTitle = "";

        // 1. Check table caption
        const caption = table.querySelector("caption");
        if (caption) {
          const cText = cleanCell(caption);
          if (
            cText.includes("الفصل") ||
            cText.includes("الدورة") ||
            /20\d\d/.test(cText)
          ) {
            semesterTitle = cText.split("\n")[0].trim();
          }
        }

        // 2. Check table header cell with colspan (frequent in Edugate PrimeFaces)
        if (!semesterTitle) {
          const headerColspan = table.querySelector(
            "th[colspan], td[colspan], .ui-datatable-header",
          );
          if (headerColspan) {
            const hText = cleanCell(headerColspan);
            if (
              hText.includes("الفصل") ||
              hText.includes("الدورة") ||
              /20\d\d/.test(hText)
            ) {
              semesterTitle = hText.split("\n")[0].trim();
            }
          }
        }

        // 3. Check enclosing fieldset or panel
        if (!semesterTitle) {
          const fieldset = table.closest(
            "fieldset, .ui-fieldset, .ui-panel, .card, .panel",
          );
          if (fieldset) {
            const legend = fieldset.querySelector(
              "legend, .ui-fieldset-legend, .ui-panel-title, .card-header, h2, h3, h4",
            );
            if (legend) {
              const lText = cleanCell(legend);
              if (
                lText.includes("الفصل") ||
                lText.includes("الدورة") ||
                /20\d\d/.test(lText)
              ) {
                semesterTitle = lText.split("\n")[0].trim();
              }
            }
          }
        }

        // 4. Check preceding siblings
        if (!semesterTitle) {
          let prev = table.previousElementSibling;
          while (prev && !semesterTitle) {
            const text = cleanCell(prev);
            if (
              text.includes("الفصل") ||
              text.includes("الدورة") ||
              /20\d\d/.test(text)
            ) {
              semesterTitle = text.split("\n")[0].trim();
              break;
            }
            prev = prev.previousElementSibling;
          }
        }

        // 5. Check parent preceding siblings
        if (!semesterTitle && table.parentElement) {
          let parentPrev = table.parentElement.previousElementSibling;
          while (parentPrev && !semesterTitle) {
            const text = cleanCell(parentPrev);
            if (
              text.includes("الفصل") ||
              text.includes("الدورة") ||
              /20\d\d/.test(text)
            ) {
              semesterTitle = text.split("\n")[0].trim();
              break;
            }
            parentPrev = parentPrev.previousElementSibling;
          }
        }

        // Column mapping
        const colMap = {
          code: -1,
          name: -1,
          credits: -1,
          grade: -1,
          status: -1,
          regStatus: -1,
        };
        headers.forEach((h, idx) => {
          if (/(رمز|رقم|كود)\s*(المقرر|المساق|المادة)?|code/i.test(h))
            colMap.code = idx;
          else if (/(اسم|عنوان)\s*(المقرر|المساق|المادة)|name|title/i.test(h))
            colMap.name = idx;
          else if (/(ساعات|الساعات|معتمدة|س\.م|س\.ع|credits|cr|hrs)/i.test(h))
            colMap.credits = idx;
          else if (/(علامة|الدرجة|النتيجة|العلامة|grade|mark|score)/i.test(h))
            colMap.grade = idx;
          else if (/(تقدير|التقدير|status|evaluation)/i.test(h))
            colMap.status = idx;
          else if (/(حالة|الحالة)/i.test(h)) colMap.regStatus = idx;
        });

        const rows = [];
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll("td"));
          if (tds.length < 2) continue;
          const cells = tds.map(cleanCell);
          const fullRowText = cells.join(" ");

          // Support single-table transcripts where semester titles appear as divider rows
          if (
            (fullRowText.includes("الفصل") || fullRowText.includes("الدورة")) &&
            /20\d\d/.test(fullRowText) &&
            !fullRowText.includes("رمز") &&
            !fullRowText.includes("المقرر")
          ) {
            if (rows.length > 0) {
              results.push({
                semesterTitle:
                  semesterTitle || `الفصل الدراسي ${results.length + 1}`,
                rows: [...rows],
              });
              rows.length = 0;
            }
            semesterTitle = fullRowText.split("\n")[0].trim();
            continue;
          }

          // Find course code
          let code = "";
          if (colMap.code !== -1 && cells[colMap.code]) {
            const m = cells[colMap.code].match(/\b\d{6,8}\b/);
            if (m) code = m[0];
          }
          if (!code) {
            for (const c of cells) {
              const m = c.match(/\b\d{6,8}\b/);
              if (m) {
                code = m[0];
                break;
              }
            }
          }
          if (!code) continue;

          // Find course name
          let name = "";
          if (
            colMap.name !== -1 &&
            cells[colMap.name] &&
            !/^\d+$/.test(cells[colMap.name])
          ) {
            name = cells[colMap.name];
          } else {
            const nameCandidate = cells.find(
              (c) =>
                c !== code &&
                c.length > 3 &&
                !/^\d+(\.\d+)?$/.test(c) &&
                !/(ناجح|راسب|محتسب|معفى|معفاة|مسجل|معادل|منسحب)/i.test(c),
            );
            name = nameCandidate || `مساق ${code}`;
          }
          name = name.replace(/^اسم\s*المقرر\s*/, "").trim();

          // Find credits
          let credits = 3;
          if (colMap.credits !== -1 && /^\d+$/.test(cells[colMap.credits])) {
            credits = parseInt(cells[colMap.credits], 10) || 3;
          } else {
            const credCandidate = cells.find(
              (c) => c !== code && /^[1-6]$/.test(c),
            );
            if (credCandidate) credits = parseInt(credCandidate, 10);
          }

          // Find grade (numeric score)
          let grade = null;
          if (colMap.grade !== -1 && cells[colMap.grade]) {
            const m = cells[colMap.grade].match(/\b([3-9]\d|100)(\.\d+)?\b/);
            if (m) grade = parseFloat(m[0]);
          }
          if (grade === null) {
            for (let i = 0; i < cells.length; i++) {
              if (i === colMap.code || i === colMap.credits) continue;
              const m = cells[i].match(/\b([3-9]\d|100)(\.\d+)?\b/);
              if (m) {
                grade = parseFloat(m[0]);
                break;
              }
            }
          }

          // Find status / evaluation
          let statusText = "";
          if (colMap.status !== -1 && cells[colMap.status]) {
            statusText = cells[colMap.status];
          } else {
            const statusCandidate = cells.find((c) =>
              /(ناجح|راسب|محتسب|معفى|معفاة|مسجل|معادل|منسحب|غير مكتمل|حرمان|غياب|اجتياز|pass|fail|exempt|incomplete|withdrawn)/i.test(
                c,
              ),
            );
            statusText = statusCandidate || "";
          }
          statusText = statusText
            .replace(/^الحالة\s*/, "")
            .replace(/^التقدير\s*/, "")
            .trim();

          rows.push({
            code,
            name,
            credits,
            grade,
            statusText,
          });
        }

        if (rows.length > 0) {
          results.push({
            semesterTitle:
              semesterTitle || `الفصل الدراسي ${results.length + 1}`,
            rows,
          });
        }
      }
      return results;
    });

    const passedCourseIds = new Set();
    const registeredCourseIds = new Set();
    const failedCourseIds = new Set();
    const courseGrades = {};
    const structuredSemesters = [];

    // Sort semester tables strictly chronologically (oldest -> newest)
    // so any retake in a newer semester naturally updates courseGrades and status!
    const chronologicalTables = [...semesterTables].sort(
      (a, b) =>
        parseSemesterWeight(a.semesterTitle) -
        parseSemesterWeight(b.semesterTitle),
    );

    const latestTable =
      chronologicalTables.length > 0
        ? chronologicalTables[chronologicalTables.length - 1]
        : null;

    for (const semTable of chronologicalTables) {
      const isLatestSemester = semTable === latestTable;
      const semCourses = [];
      for (const row of semTable.rows) {
        const { code, name, credits, grade, statusText } = row;
        const rowStr = `${statusText} ${grade !== null ? grade : ""}`;

        const isExplicitPass =
          /(ناجح|محتسب|معادل|معفى|معفاة|اجتياز|pass|exempt|cr)/i.test(
            statusText,
          );
        const isExplicitFail =
          /(راسب|غير مجتاز|حرمان|غياب|fail|withdrawn|منسحب)/i.test(statusText);

        let isPassed = false;
        let isFailed = false;
        let isRegistered = false;

        if (grade !== null) {
          if (grade >= 50) {
            isPassed = true;
          } else {
            isFailed = true;
          }
        } else if (isExplicitPass) {
          isPassed = true;
        } else if (isExplicitFail) {
          isFailed = true;
        } else if (!isLatestSemester) {
          // In an older semester without an explicit failure, course is considered passed/completed
          isPassed = true;
        } else {
          // Current in-progress semester without submitted grade yet
          isRegistered = true;
        }

        const resolvedStatus = isPassed
          ? statusText || "ناجح"
          : isFailed
            ? statusText || "راسب"
            : "مسجل";

        semCourses.push({
          code,
          name,
          status: resolvedStatus,
          credits,
          grade,
          isPassed,
          isRegistered,
          isFailed,
        });

        // Update latest course grade and status:
        if (grade !== null) {
          courseGrades[code] = grade;
        } else if (isPassed && !courseGrades[code]) {
          courseGrades[code] = -1; // Non-numerical pass/fail course (excluded from GPA calculation)
        }

        if (isPassed) {
          passedCourseIds.add(code);
          failedCourseIds.delete(code);
          registeredCourseIds.delete(code);
        } else if (isFailed) {
          failedCourseIds.add(code);
          passedCourseIds.delete(code);
          registeredCourseIds.delete(code);
        } else if (isRegistered) {
          registeredCourseIds.add(code);
        }
      }

      structuredSemesters.push({
        title: semTable.semesterTitle || "فصل دراسي",
        courses: semCourses,
      });
    }

    // Keep structuredSemesters in newest-first order for student timeline display
    structuredSemesters.sort(
      (a, b) => parseSemesterWeight(b.title) - parseSemesterWeight(a.title),
    );

    // 3.5. Scrape Exemption / Placement Exams
    const exemptionExams = [];
    try {
      await navigateEdugateSection(page, {
        urls: EDUGATE_EXEMPTION_EXAMS_URLS,
        menuSelectors: [
          'a:has-text("امتحانات المستوى")',
          'a:has-text("امتحانات الإعفاء")',
          'a:has-text("المستوى")',
          'a[href*="exemption"]',
        ],
        verifyFn: async (p) => {
          return await p
            .evaluate(() => {
              const txt =
                (document.body?.innerText || "") +
                (document.body?.textContent || "");
              return (
                txt.includes("امتحان") ||
                txt.includes("المستوى") ||
                txt.includes("الإعفاء")
              );
            })
            .catch(() => false);
        },
        label: "امتحانات المستوى والإعفاء",
      });

      const scrapedExams = await page.evaluate(() => {
        function norm(s) {
          if (!s) return "";
          return s
            .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
            .trim();
        }

        const items = [];
        const tables = Array.from(
          document.querySelectorAll("table, .ui-datatable"),
        );

        for (const table of tables) {
          const headerThs = Array.from(
            table.querySelectorAll(
              "thead th, tr:first-child th, .ui-state-default",
            ),
          );
          const headers = headerThs.map((th) =>
            norm(th.textContent || th.innerText).toLowerCase(),
          );

          let examIdx = -1;
          let semIdx = -1;
          let exemptCoursesIdx = -1;
          let passedIdx = -1;

          headers.forEach((h, idx) => {
            if (/(امتحان|الامتحان|exam)/i.test(h)) examIdx = idx;
            else if (/(فصل|الفصل|semester)/i.test(h)) semIdx = idx;
            else if (
              /(مقررات معفاة|المقررات المعفاة|المواد المعفاة|المقررات|المعفاة|exempt)/i.test(
                h,
              )
            )
              exemptCoursesIdx = idx;
            else if (/(ناجح|النتيجة|الحالة|اجتياز|pass|result)/i.test(h))
              passedIdx = idx;
          });

          const rows = Array.from(
            table.querySelectorAll("tbody tr, .ui-datatable-data tr, tr"),
          );

          for (const tr of rows) {
            if (tr.querySelector("th") && !tr.querySelector("td")) continue;

            const tds = Array.from(tr.querySelectorAll("td"));
            if (tds.length === 0) continue;

            const cells = tds.map((td) => norm(td.textContent || td.innerText));
            const rowText = cells.join(" ");

            if (rowText.includes("الامتحان") && rowText.includes("المقررات"))
              continue;

            const hasCheckIcon = Boolean(
              tr.querySelector(
                ".ui-icon-check, .ui-icon-circle-check, .fa-check, svg.lucide-check, [class*='check'], [class*='success']",
              ) || tr.querySelector("input[type='checkbox']:checked"),
            );

            const hasCloseIcon = Boolean(
              tr.querySelector(
                ".ui-icon-close, .ui-icon-circle-close, .fa-times, .fa-close, [class*='close'], [class*='error'], [class*='danger']",
              ),
            );

            let examName =
              examIdx !== -1 && cells[examIdx] ? cells[examIdx] : "";
            let semester = semIdx !== -1 && cells[semIdx] ? cells[semIdx] : "";
            let exemptedCoursesRaw =
              exemptCoursesIdx !== -1 && cells[exemptCoursesIdx]
                ? cells[exemptCoursesIdx]
                : "";
            let passedRaw =
              passedIdx !== -1 && cells[passedIdx] ? cells[passedIdx] : "";

            if (exemptCoursesIdx === -1) {
              const codeCell = cells.find((c) => /\b\d{6,8}\b/.test(c));
              if (codeCell) exemptedCoursesRaw = codeCell;
            }
            if (!examName && cells.length > 0) {
              examName = cells[0];
            }
            if (!semester && cells.length > 1 && /20\d\d/.test(cells[1])) {
              semester = cells[1];
            }

            items.push({
              cells,
              text: rowText,
              examName,
              semester,
              exemptedCoursesRaw,
              passedRaw,
              hasCheckIcon,
              hasCloseIcon,
            });
          }
        }

        if (items.length === 0) {
          const genericRows = Array.from(
            document.querySelectorAll(
              "table tbody tr, table tr, .ui-datatable-data tr",
            ),
          );
          for (const tr of genericRows) {
            const cells = Array.from(tr.querySelectorAll("td, th")).map((td) =>
              norm(td.textContent || td.innerText),
            );
            if (cells.length >= 2) {
              items.push({
                cells,
                text: cells.join(" "),
                examName: cells[0] || "",
                exemptedCoursesRaw:
                  cells.find((c) => /\b\d{6,8}\b/.test(c)) || "",
                hasCheckIcon: Boolean(
                  tr.querySelector(".ui-icon-check, .fa-check"),
                ),
                hasCloseIcon: Boolean(
                  tr.querySelector(".ui-icon-close, .fa-times"),
                ),
              });
            }
          }
        }

        return items;
      });

      const { exemptionExams: parsedExams, passedCourseCodes } =
        parseExemptionExamRows(scrapedExams);
      for (const ex of parsedExams) {
        exemptionExams.push(ex);
      }

      for (const code of passedCourseCodes) {
        passedCourseIds.add(code);
        failedCourseIds.delete(code);
        registeredCourseIds.delete(code);
        const matchingExam = parsedExams.find(
          (e) => e.code === code && e.grade !== null,
        );
        if (matchingExam?.grade !== null && matchingExam?.grade !== undefined) {
          courseGrades[code] = matchingExam.grade;
        } else if (!courseGrades[code]) {
          courseGrades[code] = -1; // Exemption exams are non-graded pass
        }
      }
    } catch (examErr) {
      console.warn(`⚠️ تعذر جلب صفحة امتحانات الإعفاء: ${examErr.message}`);
    }

    // 3.6. Smart Remedial & Prerequisite Inference
    if (passedCourseIds.has("15200112")) {
      // If student passed English 2 (15200112), English 1 (15200106) must be passed/exempted
      passedCourseIds.add("15200106");
      if (!courseGrades["15200106"]) courseGrades["15200106"] = -1;
      if (!exemptionExams.some((e) => e.code === "15200106")) {
        exemptionExams.push({
          code: "15200106",
          name: "اللغة الإنجليزية (1)",
          status: "معفى (مستنتج من اجتياز لغة إنجليزية 2)",
          examName: "امتحان مستوى انجليزي",
          grade: null,
          isPassed: true,
        });
      }
    }

    if (passedCourseIds.has("15200106") || passedCourseIds.has("15200112")) {
      passedCourseIds.add("15200099");
      if (!courseGrades["15200099"]) courseGrades["15200099"] = -1;
      if (!exemptionExams.some((e) => e.code === "15200099")) {
        exemptionExams.push({
          code: "15200099",
          name: "إنجليزي إستدراكي",
          status: "معفى (مستنتج من اجتياز لغة إنجليزية 1)",
          grade: null,
          isPassed: true,
        });
      }
    }

    if (
      passedCourseIds.has("12140101") ||
      passedCourseIds.has("12010101") ||
      passedCourseIds.has("12140111")
    ) {
      passedCourseIds.add("13010006");
      if (!courseGrades["13010006"]) courseGrades["13010006"] = -1;
      if (!exemptionExams.some((e) => e.code === "13010006")) {
        exemptionExams.push({
          code: "13010006",
          name: "مهارات الحاسوب وتطبيقاته",
          status: "معفى/ناجح",
          grade: null,
          isPassed: true,
        });
      }
    }

    if (passedCourseIds.has("15200103")) {
      passedCourseIds.add("15200098");
      if (!courseGrades["15200098"]) courseGrades["15200098"] = -1;
    }

    // 3.7. Scrape Major Plan (/student/majorPlan)
    let scrapedPlanCourses = [];
    let scrapedMajorCategoryRequirements = {};
    let scrapedMajorTotalCredits = 0;
    try {
      await navigateEdugateSection(page, {
        urls: EDUGATE_MAJOR_PLAN_URLS,
        menuSelectors: [
          'a:has-text("الخطة الدراسية")',
          'a:has-text("خطة الطالب")',
          'a:has-text("شجرة الخطة")',
          'a:has-text("الخطة الاسترشادية")',
          'a:has-text("الخطة")',
          'span:has-text("الخطة الدراسية")',
          'a[href*="majorPlan"]',
          'a[href*="plan"]',
          'a[href*="curriculum"]',
        ],
        keywords: [
          "الخطة الدراسية",
          "خطة الطالب",
          "شجرة الخطة",
          "الخطة الاسترشادية",
          "الخطة",
          "خطة التخصص",
          "majorPlan",
          "Study Plan",
          "Academic Plan",
        ],
        verifyFn: async (p) => {
          return await p
            .evaluate(() => {
              const txt =
                (document.body?.innerText || "") +
                (document.body?.textContent || "");
              const hasTables =
                document.querySelectorAll(
                  "table, .ui-treetable, .ui-datatable, .ui-accordion",
                ).length > 0;
              return (
                (txt.includes("الخطة") ||
                  txt.includes("المقرر") ||
                  txt.includes("متطلب") ||
                  txt.includes("الساعات")) &&
                hasTables
              );
            })
            .catch(() => false);
        },
        label: "الخطة الدراسية",
      });

      // Expand all collapsed accordions and tree togglers on the study plan page and force visibility
      await page
        .evaluate(() => {
          document
            .querySelectorAll(
              ".ui-accordion-content, .ui-panel-content, .ui-treetable-data, .ui-datatable-data",
            )
            .forEach((el) => {
              el.style.display = "block";
              el.style.visibility = "visible";
              el.style.height = "auto";
            });
          document
            .querySelectorAll(".ui-accordion-header:not(.ui-state-active)")
            .forEach((h) => {
              try {
                h.click();
              } catch {}
            });
          document
            .querySelectorAll(
              ".ui-treetable-toggler:not(.ui-icon-triangle-1-s)",
            )
            .forEach((t) => {
              try {
                t.click();
              } catch {}
            });
          document.querySelectorAll(".ui-fieldset-toggler").forEach((t) => {
            try {
              t.click();
            } catch {}
          });
          const showBtn = Array.from(
            document.querySelectorAll(
              "button, input[type='submit'], .ui-button",
            ),
          ).find((b) => {
            const t = (b.textContent || b.innerText || b.value || "").trim();
            return t === "عرض" || t === "بحث" || t.includes("عرض الخطة");
          });
          if (showBtn) {
            try {
              showBtn.click();
            } catch {}
          }
        })
        .catch(() => {});
      await page.waitForTimeout(300);

      const scrapedPlanResult = await page.evaluate(() => {
        function norm(s) {
          if (!s) return "";
          return s
            .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
            .trim();
        }

        function cleanCell(el) {
          if (!el) return "";
          const tag = (el.tagName || "").toLowerCase();
          if (tag === "th") {
            return norm(el.textContent || el.innerText || "").trim();
          }
          const clone = el.cloneNode(true);
          clone
            .querySelectorAll(".ui-column-title, script, style")
            .forEach((c) => c.remove());
          return norm(clone.textContent || clone.innerText || "").trim();
        }

        const results = [];
        const seenCodes = new Set();
        let currentCategory = "متطلب تخصص إجباري";
        let currentSemester = "";

        // Query all tables or data containers on the study plan page
        const tables = Array.from(
          document.querySelectorAll(
            "table, .ui-treetable-table, .ui-datatable-table, .ui-treetable, .ui-datatable",
          ),
        ).filter(
          (t) =>
            !t.parentElement?.closest(
              "table, .ui-treetable-table, .ui-datatable-table",
            ),
        );

        for (const table of tables) {
          // Detect category and semester from container headers
          const parentContainer = table.closest(
            "fieldset, .ui-fieldset, .ui-panel, .ui-accordion-content, .card, div",
          );
          const containerHeader = parentContainer
            ? norm(
                parentContainer.querySelector(
                  "legend, .ui-panel-title, .ui-accordion-header, h2, h3, h4",
                )?.textContent || "",
              )
            : "";
          const headerContext = `${containerHeader} ${norm(table.querySelector("caption, th[colspan]")?.textContent || "")}`;

          if (headerContext.includes("متطلب جامعة")) {
            currentCategory = headerContext.includes("إجباري")
              ? "متطلب جامعة إجباري"
              : "متطلب جامعة اختياري";
          } else if (headerContext.includes("متطلب كلية")) {
            currentCategory = "متطلب كلية إجباري";
          } else if (headerContext.includes("متطلب تخصص")) {
            currentCategory = headerContext.includes("إجباري")
              ? "متطلب تخصص إجباري"
              : "متطلب تخصص اختياري";
          } else if (headerContext.includes("استدراكي")) {
            currentCategory = "متطلب استدراكي إجباري";
          }

          if (
            headerContext.includes("السنة") ||
            headerContext.includes("الفصل")
          ) {
            currentSemester = headerContext.split("\n")[0].trim();
          }

          // Build colMap for THIS specific table
          const headerCells = Array.from(
            table.querySelectorAll(
              "th, thead td, tr.ui-state-default th, tr.ui-widget-header th, tr:first-child th",
            ),
          );
          const headers = headerCells.map((th) => cleanCell(th).toLowerCase());
          const colMap = {
            code: -1,
            name: -1,
            credits: -1,
            prereq: -1,
            status: -1,
          };
          headers.forEach((h, idx) => {
            if (/(رمز|رقم|كود)\s*(المقرر|المساق|المادة)?|code/i.test(h))
              colMap.code = idx;
            else if (/(اسم|عنوان)\s*(المقرر|المساق|المادة)|name|title/i.test(h))
              colMap.name = idx;
            else if (/(ساعات|الساعات|معتمدة|س\.م|س\.ع|credits|cr|hrs)/i.test(h))
              colMap.credits = idx;
            else if (/(سابق|المتطلب\s*السابق|متطلب|prereq)/i.test(h))
              colMap.prereq = idx;
            else if (/(حالة|الوضع|الحالة|status)/i.test(h)) colMap.status = idx;
          });

          const rows = Array.from(table.querySelectorAll("tbody tr, tr"));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll("td, th")).map(
              cleanCell,
            );
            if (cells.length < 2) continue;
            const fullRowText = cells.join(" ");

            // Determine if row has a course code (6 to 8 digits)
            const hasCode = cells.some((c) => /\b\d{6,8}\b/.test(c));
            if (!hasCode) {
              // Row without course code is a section divider or category header row
              if (fullRowText.includes("متطلب جامعة")) {
                currentCategory = fullRowText.includes("إجباري")
                  ? "متطلب جامعة إجباري"
                  : "متطلب جامعة اختياري";
              } else if (fullRowText.includes("متطلب كلية")) {
                currentCategory = "متطلب كلية إجباري";
              } else if (fullRowText.includes("متطلب تخصص")) {
                currentCategory = fullRowText.includes("إجباري")
                  ? "متطلب تخصص إجباري"
                  : "متطلب تخصص اختياري";
              } else if (fullRowText.includes("استدراكي")) {
                currentCategory = "متطلب استدراكي إجباري";
              }
              if (
                fullRowText.includes("السنة") ||
                fullRowText.includes("الفصل")
              ) {
                currentSemester = fullRowText.split("\n")[0].trim();
              }
              continue; // Skip non-course header rows
            }

            // Extract course code
            let code = "";
            if (colMap.code !== -1 && cells[colMap.code]) {
              const m = cells[colMap.code].match(/\b\d{6,8}\b/);
              if (m) code = m[0];
            }
            if (!code) {
              for (const c of cells) {
                const m = c.match(/\b\d{6,8}\b/);
                if (m) {
                  code = m[0];
                  break;
                }
              }
            }
            if (!code || seenCodes.has(code)) continue;
            seenCodes.add(code);

            // Extract course name
            let name = "";
            if (
              colMap.name !== -1 &&
              cells[colMap.name] &&
              !/^\d+$/.test(cells[colMap.name])
            ) {
              name = cells[colMap.name];
            } else {
              const nameCandidate = cells.find(
                (c) =>
                  c !== code &&
                  c.length > 3 &&
                  !/^\d+(\.\d+)?$/.test(c) &&
                  !/(ناجح|راسب|محتسب|معفى|معفاة|مسجل|معادل|منسحب|متطلب|إجباري|اختياري)/i.test(
                    c,
                  ),
              );
              name = nameCandidate || `مساق ${code}`;
            }
            name = name.replace(/^اسم\s*المقرر\s*/, "").trim();

            // Extract credits
            let credits = 3;
            if (colMap.credits !== -1 && /^\d+$/.test(cells[colMap.credits])) {
              credits = parseInt(cells[colMap.credits], 10) || 3;
            } else {
              const credCandidate = cells.find(
                (c) => c !== code && /^[1-6]$/.test(c),
              );
              credits = credCandidate ? parseInt(credCandidate, 10) : 3;
            }

            // Extract prerequisites
            let prerequisites = [];
            if (colMap.prereq !== -1 && cells[colMap.prereq]) {
              prerequisites = (
                cells[colMap.prereq].match(/\b\d{6,8}\b/g) || []
              ).filter((c) => c !== code);
            }
            if (prerequisites.length === 0) {
              for (let i = 0; i < cells.length; i++) {
                if (
                  i === colMap.code ||
                  i === colMap.name ||
                  i === colMap.credits
                )
                  continue;
                const found = (cells[i].match(/\b\d{6,8}\b/g) || []).filter(
                  (c) => c !== code,
                );
                if (found.length > 0) {
                  prerequisites.push(...found);
                }
              }
            }
            prerequisites = Array.from(new Set(prerequisites));

            let rowCategory = currentCategory;
            if (fullRowText.includes("متطلب جامعة")) {
              rowCategory = fullRowText.includes("إجباري")
                ? "متطلب جامعة إجباري"
                : "متطلب جامعة اختياري";
            } else if (fullRowText.includes("متطلب كلية")) {
              rowCategory = "متطلب كلية إجباري";
            } else if (fullRowText.includes("متطلب تخصص")) {
              rowCategory = fullRowText.includes("إجباري")
                ? "متطلب تخصص إجباري"
                : "متطلب تخصص اختياري";
            } else if (
              fullRowText.includes("استدراكي") ||
              isRemedialCourseCode(code, name)
            ) {
              rowCategory = "متطلب استدراكي إجباري";
            }

            const isCompleted =
              fullRowText.includes("منجز") ||
              fullRowText.includes("معفى") ||
              fullRowText.includes("معفاة") ||
              fullRowText.includes("ناجح") ||
              fullRowText.includes("محتسب") ||
              fullRowText.includes("معادل");

            const isRegistered =
              !isCompleted &&
              (fullRowText.includes("مسجل") ||
                fullRowText.includes("قيد الدراسة"));

            results.push({
              id: code,
              code,
              name,
              credits,
              category: rowCategory,
              prerequisites,
              coPrerequisites: [],
              semester: currentSemester,
              recommendedSemester: currentSemester,
              isCompleted,
              isRegistered,
            });
          }
        }
        const scrapedCategoryRequirements = {};
        let scrapedTotalCredits = 0;

        // Scrape category requirements from summary tables or rows
        document
          .querySelectorAll("table, .ui-datatable, .ui-panelgrid")
          .forEach((tbl) => {
            const rows = Array.from(tbl.querySelectorAll("tr"));
            rows.forEach((r) => {
              const text = norm(r.textContent || "");
              const cells = Array.from(r.querySelectorAll("td, th")).map((c) =>
                norm(c.textContent || "").trim(),
              );
              if (cells.length >= 2) {
                let matchedCat = "";
                if (
                  text.includes("متطلب جامعة") ||
                  text.includes("متطلبات جامعة") ||
                  text.includes("متطلبات الجامعة")
                ) {
                  matchedCat =
                    text.includes("إجباري") || text.includes("إجبارية")
                      ? "متطلب جامعة إجباري"
                      : "متطلب جامعة اختياري";
                } else if (
                  text.includes("متطلب كلية") ||
                  text.includes("متطلبات كلية") ||
                  text.includes("متطلبات الكلية")
                ) {
                  matchedCat =
                    text.includes("اختياري") || text.includes("اختيارية")
                      ? "متطلب كلية اختياري"
                      : "متطلب كلية إجباري";
                } else if (
                  text.includes("متطلب تخصص") ||
                  text.includes("متطلبات تخصص") ||
                  text.includes("متطلبات التخصص")
                ) {
                  matchedCat =
                    text.includes("اختياري") || text.includes("اختيارية")
                      ? "متطلب تخصص اختياري"
                      : "متطلب تخصص إجباري";
                } else if (
                  text.includes("استدراكي") ||
                  text.includes("استدراكية")
                ) {
                  matchedCat = "متطلب استدراكي إجباري";
                }

                if (matchedCat) {
                  for (let i = 1; i < cells.length; i++) {
                    const num = parseInt(cells[i], 10);
                    if (!isNaN(num) && num >= 1 && num <= 140) {
                      scrapedCategoryRequirements[matchedCat] = num;
                      break;
                    }
                  }
                }

                if (
                  text.includes("المجموع") ||
                  text.includes("الإجمالي") ||
                  text.includes("إجمالي الساعات") ||
                  text.includes("مجموع الساعات")
                ) {
                  for (let i = 1; i < cells.length; i++) {
                    const num = parseInt(cells[i], 10);
                    if (!isNaN(num) && num >= 60 && num <= 260) {
                      scrapedTotalCredits = num;
                      break;
                    }
                  }
                }
              }
            });
          });

        // Scrape category requirements from accordion / fieldset / header elements
        document
          .querySelectorAll(
            "fieldset, .ui-fieldset, .ui-panel, .ui-accordion, div",
          )
          .forEach((container) => {
            const headerEl = container.querySelector(
              "legend, .ui-fieldset-legend, .ui-panel-title, .ui-accordion-header, h2, h3, h4, caption",
            );
            if (!headerEl) return;
            const headerText = norm(headerEl.textContent || "").trim();
            if (!headerText) return;

            let matchedCat = "";
            if (
              headerText.includes("متطلب جامعة") ||
              headerText.includes("متطلبات جامعة") ||
              headerText.includes("متطلبات الجامعة")
            ) {
              matchedCat =
                headerText.includes("إجباري") || headerText.includes("إجبارية")
                  ? "متطلب جامعة إجباري"
                  : "متطلب جامعة اختياري";
            } else if (
              headerText.includes("متطلب كلية") ||
              headerText.includes("متطلبات كلية") ||
              headerText.includes("متطلبات الكلية")
            ) {
              matchedCat =
                headerText.includes("اختياري") ||
                headerText.includes("اختيارية")
                  ? "متطلب كلية اختياري"
                  : "متطلب كلية إجباري";
            } else if (
              headerText.includes("متطلب تخصص") ||
              headerText.includes("متطلبات تخصص") ||
              headerText.includes("متطلبات التخصص")
            ) {
              matchedCat =
                headerText.includes("اختياري") ||
                headerText.includes("اختيارية")
                  ? "متطلب تخصص اختياري"
                  : "متطلب تخصص إجباري";
            } else if (
              headerText.includes("استدراكي") ||
              headerText.includes("استدراكية")
            ) {
              matchedCat = "متطلب استدراكي إجباري";
            }

            if (matchedCat && !scrapedCategoryRequirements[matchedCat]) {
              const m =
                headerText.match(
                  /(?:ساعات|ساعة|المعتمدة|المطلوبة|س\.م|عدد\s*الساعات)\s*[:：\(\[\s]*(\d{1,3})/i,
                ) ||
                headerText.match(/\((\d{1,3})\s*(?:ساعة|ساعات|س\.م)?\)/) ||
                headerText.match(/\b(\d{1,3})\s*(?:ساعة|ساعات|س\.م)\b/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (num >= 1 && num <= 140) {
                  scrapedCategoryRequirements[matchedCat] = num;
                }
              }
            }
          });

        return {
          courses: results,
          categoryRequirements: scrapedCategoryRequirements,
          totalDegreeCredits: scrapedTotalCredits,
        };
      });

      if (
        scrapedPlanResult &&
        typeof scrapedPlanResult === "object" &&
        !Array.isArray(scrapedPlanResult)
      ) {
        scrapedPlanCourses = scrapedPlanResult.courses || [];
        scrapedMajorCategoryRequirements =
          scrapedPlanResult.categoryRequirements || {};
        scrapedMajorTotalCredits = scrapedPlanResult.totalDegreeCredits || 0;
      } else {
        scrapedPlanCourses = Array.isArray(scrapedPlanResult)
          ? scrapedPlanResult
          : [];
      }

      for (const pc of scrapedPlanCourses) {
        if (pc.isCompleted) {
          passedCourseIds.add(pc.code);
          failedCourseIds.delete(pc.code);
          registeredCourseIds.delete(pc.code);
        } else if (pc.isRegistered) {
          if (!passedCourseIds.has(pc.code)) {
            registeredCourseIds.add(pc.code);
          }
        }
      }
    } catch (planErr) {
      console.warn(`⚠️ تعذر جلب صفحة الخطة الدراسية: ${planErr.message}`);
    }

    // 4. Match with Major Curriculum Plan
    // Ground truth inference: check courses in the transcript to establish student's real major
    const allTranscriptCourses = structuredSemesters.flatMap(
      (s) => s.courses || [],
    );
    const allKnownCourses = [...allTranscriptCourses, ...scrapedPlanCourses];
    const inferredMajor = inferMajorFromCourses(
      allKnownCourses,
      actualStudentId,
    );
    let majorId = inferredMajor.id;
    if (
      !majorName ||
      (majorName.includes("أنظمة الحاسوب") &&
        !allTranscriptCourses.some((c) => c.code === "12110236"))
    ) {
      majorName = inferredMajor.name;
      college = inferredMajor.college;
      majorId = inferredMajor.id;
    } else {
      majorId = inferredMajor.id || slugifyMajor(majorName);
    }

    const isCseMajor =
      (majorId === "cse" || majorName.includes("أنظمة الحاسوب")) &&
      !majorName.includes("الذكاء") &&
      !majorName.includes("برمجيات") &&
      !majorName.includes("علم الحاسوب");

    const existingCohortPlan = getMajorCohortPlan(majorId, resolvedCohort);
    const baseMajor = existingCohortPlan || getMajorById(majorId);

    let baseCourses = [];
    if (Array.isArray(scrapedPlanCourses) && scrapedPlanCourses.length > 0) {
      console.log(
        `📋 تم استخدام الخطة المسحوبة مباشرة من بوابة الطالب (${scrapedPlanCourses.length} مادة).`,
      );
      baseCourses = applyCurriculumPrerequisitesAndSemesters(
        scrapedPlanCourses,
        majorId,
        majorName,
      );
    } else if (
      baseMajor &&
      Array.isArray(baseMajor.courses) &&
      baseMajor.courses.length > 0 &&
      (isCseMajor ||
        !baseMajor.courses.some((c) => (c.id || c.code) === "12110236"))
    ) {
      console.log(
        `📦 استخدام الخطة المعتمدة المحفوظة للتخصص: ${majorName} (${baseMajor.courses.length} مادة).`,
      );
      baseCourses = applyCurriculumPrerequisitesAndSemesters(
        baseMajor.courses,
        majorId,
        majorName,
      );
    } else if (isCseMajor) {
      console.log("📐 استخدام الخطة العامة لهندسة أنظمة الحاسوب.");
      baseCourses = extractCoursesFromDataTs();
    } else if (majorId === "ai" || majorName.includes("الذكاء")) {
      console.log(
        "✨ استخدام الخطة المعتمدة الكاملة لتخصص الذكاء الاصطناعي (132 ساعة).",
      );
      baseCourses = AI_CURRICULUM_COURSES;
    } else {
      console.log(
        `✨ بناء خطة مخصصة ومرتبة لتخصص (${majorName}) من سجل الطالب والكتالوج الجامعي...`,
      );
      const builtCourses = [];
      const seenCodes = new Set();

      // A) All courses from student transcript (completed, registered, failed)
      for (const sem of structuredSemesters) {
        for (const sc of sem.courses) {
          if (!seenCodes.has(sc.code)) {
            seenCodes.add(sc.code);
            const isRem = isRemedialCourseCode(sc.code, sc.name);
            const isUnivMandatory =
              sc.code.startsWith("1520") || sc.code.startsWith("1301");
            const isUnivElective =
              sc.code.startsWith("1302") || sc.code.startsWith("152002");
            const isFaculty =
              sc.code.startsWith("1501") ||
              sc.code.startsWith("1502") ||
              sc.code.startsWith("1506");

            let category = "متطلب تخصص إجباري";
            if (isRem) category = "متطلب استدراكي إجباري";
            else if (isUnivMandatory) category = "متطلب جامعة إجباري";
            else if (isUnivElective) category = "متطلب جامعة اختياري";
            else if (isFaculty) category = "متطلب كلية إجباري";

            builtCourses.push({
              id: sc.code,
              code: sc.code,
              name: sc.name,
              credits: sc.credits || 3,
              category,
              prerequisites: [],
              coPrerequisites: [],
              semester: sem.title,
              recommendedSemester: sem.title,
            });
          }
        }
      }

      // B) Core University Requirements for any PTUK degree
      const coreUniversityRequirements = [
        {
          id: "15200099",
          name: "إنجليزي إستدراكي",
          credits: 3,
          category: "متطلب استدراكي إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "13010006",
          name: "مهارات الحاسوب وتطبيقاته",
          credits: 1,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "13010007",
          name: "مهارات الاتصال",
          credits: 1,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "15200101",
          name: "القضية الفلسطينية",
          credits: 3,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "15200102",
          name: "اللغة العربية",
          credits: 3,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "15200104",
          name: "خدمة المجتمع",
          credits: 1,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "15200106",
          name: "اللغة الإنجليزية (1)",
          credits: 3,
          category: "متطلب جامعة إجباري",
          prerequisites: ["15200099"],
          seasonal: "both",
        },
        {
          id: "15200107",
          name: "الدراسات الإسلامية",
          credits: 3,
          category: "متطلب جامعة إجباري",
          prerequisites: [],
          seasonal: "both",
        },
        {
          id: "15200112",
          name: "اللغة الإنجليزية (2)",
          credits: 3,
          category: "متطلب جامعة إجباري",
          prerequisites: ["15200106"],
          seasonal: "both",
        },
      ];

      for (const core of coreUniversityRequirements) {
        if (!seenCodes.has(core.id)) {
          seenCodes.add(core.id);
          builtCourses.push(core);
        }
      }

      // C) Query university schedule catalog for courses matching student's specialization department
      const deptPrefixes = new Set();
      for (const c of builtCourses) {
        if (
          !c.id.startsWith("15") &&
          !c.id.startsWith("13") &&
          c.id.length >= 4
        ) {
          deptPrefixes.add(c.id.substring(0, 4));
        }
      }

      if (deptPrefixes.size > 0) {
        try {
          const catalogCourses = await getCourses({});
          for (const catCourse of catalogCourses) {
            const code = catCourse.code || catCourse.id;
            if (code && !seenCodes.has(code)) {
              const matchesDept = Array.from(deptPrefixes).some((p) =>
                code.startsWith(p),
              );
              if (matchesDept) {
                seenCodes.add(code);
                builtCourses.push({
                  id: code,
                  code,
                  name: catCourse.name,
                  credits: Number(catCourse.credits) || 3,
                  category: "متطلب تخصص إجباري",
                  prerequisites: [],
                  coPrerequisites: [],
                  seasonal: "both",
                });
              }
            }
          }
        } catch {}
      }

      baseCourses = applyCurriculumPrerequisitesAndSemesters(
        builtCourses,
        majorId,
        majorName,
      );
    }

    const baseCourseIds = new Set(baseCourses.map((c) => c.id || c.code));
    const coursesWithStatus = baseCourses.map((course) => {
      const cId = course.id || course.code;
      let status = "remaining";
      const grade = courseGrades[cId] ?? null;

      if (passedCourseIds.has(cId)) {
        status = "completed";
      } else if (registeredCourseIds.has(cId)) {
        status = "registered";
      } else if (failedCourseIds.has(cId)) {
        status = "failed";
      }

      return {
        id: cId,
        code: cId,
        name: course.name,
        credits: course.credits || 3,
        category: course.category || "متطلب تخصص إجباري",
        prerequisites: course.prerequisites || [],
        coPrerequisites: course.coPrerequisites || [],
        seasonal: course.seasonal || "both",
        semester: course.semester || course.recommendedSemester,
        recommendedSemester: course.recommendedSemester || course.semester,
        status,
        grade,
      };
    });

    // Also include any courses from transcript not in standard base plan (electives, remedials, transfers)
    for (const [code, grade] of Object.entries(courseGrades)) {
      if (!baseCourseIds.has(code)) {
        const semCourse = structuredSemesters
          .flatMap((s) => s.courses)
          .find((c) => c.code === code);
        const semTitle = structuredSemesters.find((s) =>
          s.courses.some((c) => c.code === code),
        )?.title;
        coursesWithStatus.push({
          id: code,
          code,
          name: semCourse?.name || `مساق ${code}`,
          credits: semCourse?.credits || 3,
          category: isRemedialCourseCode(code, semCourse?.name)
            ? "متطلب استدراكي إجباري"
            : "متطلب اختياري",
          prerequisites: [],
          coPrerequisites: [],
          semester: semTitle,
          recommendedSemester: semTitle,
          status: passedCourseIds.has(code)
            ? "completed"
            : failedCourseIds.has(code)
              ? "failed"
              : "registered",
          grade,
        });
      }
    }

    const completedCourses = coursesWithStatus.filter(
      (c) => c.status === "completed",
    );
    // Exclude remedial courses (English 15200099, Computer 13010006, Arabic 15200098) from earned degree credits
    const earnedCredits = completedCourses.reduce((sum, c) => {
      const code = String(c.code || c.id || "").trim();
      if (isRemedialCourseCode(code, c.name, c.category)) return sum;
      return sum + (c.credits || 0);
    }, 0);

    // Calculate final cumulative GPA: use university official GPA if present, else calculate accurately
    let gpa = parsedGpa;
    if (gpa === null || isNaN(gpa) || gpa <= 0) {
      let totalQualityPoints = 0;
      let totalGpaHours = 0;
      for (const c of coursesWithStatus) {
        const code = String(c.code || c.id || "").trim();
        if (isRemedialCourseCode(code, c.name, c.category)) continue;
        if (
          typeof c.grade === "number" &&
          c.grade >= 0 &&
          c.grade <= 100 &&
          c.grade !== -1
        ) {
          totalQualityPoints += c.grade * (c.credits || 3);
          totalGpaHours += c.credits || 3;
        }
      }
      gpa =
        totalGpaHours > 0
          ? parseFloat((totalQualityPoints / totalGpaHours).toFixed(2))
          : 0.0;
    }

    // Clean General Curriculum Courses (without student marks or completion flags)
    const cleanGeneralCourses = coursesWithStatus.map((c) => ({
      id: c.id,
      code: c.code || c.id,
      name: c.name,
      credits: Number(c.credits) || 3,
      category: c.category || "متطلب تخصص إجباري",
      prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites : [],
      coPrerequisites: Array.isArray(c.coPrerequisites)
        ? c.coPrerequisites
        : [],
      seasonal: c.seasonal || "both",
      semester: c.semester || c.recommendedSemester,
      recommendedSemester: c.recommendedSemester || c.semester,
    }));

    const isDiploma = Boolean(
      (college && (college.includes("دبلوم") || college.includes("متوسطة"))) ||
      (majorName && majorName.includes("دبلوم")) ||
      (scrapedDegree && scrapedDegree.includes("دبلوم")),
    );
    const isMaster = Boolean(
      (college && college.includes("دراسات عليا")) ||
      (majorName &&
        (majorName.includes("ماجستير") || majorName.includes("Master"))) ||
      (scrapedDegree && scrapedDegree.includes("ماجستير")),
    );
    const isFiveYear = Boolean(
      college &&
      college.includes("هندسة") &&
      !majorName.includes("الذكاء") &&
      !majorName.includes("علم الحاسوب"),
    );
    const defaultDegreeCredits = isDiploma
      ? 72
      : isMaster
        ? 36
        : isFiveYear
          ? 164
          : 132;
    const resolvedDegree =
      scrapedDegree ||
      (isDiploma ? "دبلوم متوسط" : isMaster ? "ماجستير" : "بكالوريوس");

    // Calculate category requirements:
    // For compulsory categories, sum compulsory course hours.
    // For elective categories, use scraped requirement from Edugate majorPlan or standard caps (never sum the entire pool of elective choices).
    const calculatedCategoryReqs = {};
    for (const c of cleanGeneralCourses) {
      const cat = c.category || "متطلب تخصص إجباري";
      if (!cat.includes("اختياري")) {
        calculatedCategoryReqs[cat] =
          (calculatedCategoryReqs[cat] || 0) + (c.credits || 0);
      }
    }

    // Set elective caps (using scraped major category requirements if available, else standard caps)
    if (
      cleanGeneralCourses.some((c) =>
        c.category?.includes("متطلب جامعة اختياري"),
      )
    ) {
      const scrapedCap =
        scrapedMajorCategoryRequirements["متطلب جامعة اختياري"];
      calculatedCategoryReqs["متطلب جامعة اختياري"] =
        scrapedCap && scrapedCap >= 3 && scrapedCap <= 18
          ? scrapedCap
          : isFiveYear
            ? 6
            : 9;
    }
    if (
      cleanGeneralCourses.some((c) =>
        c.category?.includes("متطلب تخصص اختياري"),
      )
    ) {
      const scrapedCap = scrapedMajorCategoryRequirements["متطلب تخصص اختياري"];
      calculatedCategoryReqs["متطلب تخصص اختياري"] =
        scrapedCap && scrapedCap >= 3 && scrapedCap <= 24
          ? scrapedCap
          : isFiveYear
            ? 15
            : 9;
    }
    if (
      cleanGeneralCourses.some((c) =>
        c.category?.includes("متطلب كلية اختياري"),
      )
    ) {
      const scrapedCap = scrapedMajorCategoryRequirements["متطلب كلية اختياري"];
      calculatedCategoryReqs["متطلب كلية اختياري"] =
        scrapedCap && scrapedCap >= 3 && scrapedCap <= 12 ? scrapedCap : 3;
    }

    // Total degree credits is sum of non-remedial category requirements
    let calculatedTotalCredits = Object.entries(calculatedCategoryReqs).reduce(
      (sum, [cat, cr]) => {
        if (cat.includes("استدراكي")) return sum;
        return sum + cr;
      },
      0,
    );

    const minValidCr = isDiploma ? 60 : isMaster ? 30 : 120;
    const maxValidCr = isDiploma ? 90 : isMaster ? 45 : 175;
    const finalTotalCredits =
      scrapedMajorTotalCredits >= minValidCr &&
      scrapedMajorTotalCredits <= maxValidCr
        ? scrapedMajorTotalCredits
        : calculatedTotalCredits >= minValidCr &&
            calculatedTotalCredits <= maxValidCr
          ? calculatedTotalCredits
          : defaultDegreeCredits;

    const cleanMajorKey = `${slugifyMajor(majorName)}_${resolvedCohort}`;

    const cleanMajorRecord = {
      id: cleanMajorKey,
      code: cleanMajorKey,
      name: majorName,
      cohortYear: resolvedCohort,
      displayName: `${majorName} - دفعة ${resolvedCohort}`,
      college:
        college ||
        baseMajor?.college ||
        (isFiveYear
          ? "كلية الهندسة والتكنولوجيا"
          : "كلية تكنولوجيا المعلومات والاتصالات"),
      degree: resolvedDegree,
      totalCredits: finalTotalCredits,
      categoryRequirements: calculatedCategoryReqs,
      description: `الخطة الاسترشادية العامة لتخصص ${majorName} (دفعة ${resolvedCohort})`,
      courses: cleanGeneralCourses,
      updatedAt: new Date().toISOString(),
    };

    upsertMajor(cleanMajorRecord);
    saveMajorCohortPlan(cleanMajorKey, resolvedCohort, cleanMajorRecord);

    // 5. Build Enrolled Courses with Section Details from DB
    const enrolledCourses = [];
    const dbCourses = await getCourses({
      codes: Array.from(registeredCourseIds),
    });
    const dbCourseMap = new Map(dbCourses.map((c) => [c.code, c]));

    for (const regCode of registeredCourseIds) {
      const match = dbCourseMap.get(regCode);
      const planCourse = coursesWithStatus.find((c) => c.code === regCode);
      const courseName = match?.name || planCourse?.name || regCode;

      if (match && Array.isArray(match.sections) && match.sections.length > 0) {
        const sec = match.sections[0];
        enrolledCourses.push({
          code: regCode,
          name: courseName,
          sec: sec.sec || "1",
          instructor: sec.instructor,
          room: sec.room,
          building: sec.building,
          blocks: sec.blocks || [],
        });
      } else {
        enrolledCourses.push({
          code: regCode,
          name: courseName,
          sec: "1",
          blocks: [],
        });
      }
    }

    // 6. Scrape Academic Transactions & Financial Records (graceful fetch)
    let liveTransactions = [];
    try {
      await navigateEdugateSection(page, {
        menuSelectors: [
          'a:has-text("الحركات الأكاديمية")',
          'a:has-text("حركات أكاديمية")',
          'a[href*="academicTransactions"]',
          'a[href*="transaction"]',
        ],
        urls: EDUGATE_TRANSACTIONS_URLS,
        label: "الحركات الأكاديمية",
      });

      liveTransactions = await page.evaluate(() => {
        function norm(s) {
          if (!s) return "";
          return s
            .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
            .trim();
        }
        const rows = Array.from(
          document.querySelectorAll("table tbody tr, table tr"),
        );
        return rows
          .map((r) => {
            const cells = Array.from(r.querySelectorAll("td")).map((c) =>
              norm(c.textContent || c.innerText),
            );
            if (cells.length >= 3 && cells[0]) {
              return {
                type: cells[0],
                semester: cells[1] || "",
                date: cells[2] || "",
                status: cells[3] || "معتمد",
                notes: cells[4] || "",
              };
            }
            return null;
          })
          .filter(Boolean);
      });
    } catch {}

    if (!liveTransactions || liveTransactions.length === 0) {
      liveTransactions = [];
    }

    let liveFinancial = {
      balance: financialBalance || "0 دائن",
      currency: "دينار أردني (JOD)",
      totalDebit: null,
      totalCredit: null,
      payments: [],
      hasPortalData: false,
    };

    try {
      await navigateEdugateSection(page, {
        menuSelectors: [
          'a:has-text("السجل المالي")',
          'a:has-text("البيانات المالية")',
          'a:has-text("حساب الطالب")',
          'a[href*="financial"]',
        ],
        urls: EDUGATE_FINANCIAL_URLS,
        label: "السجل المالي",
      });

      const extractedFin = await page.evaluate(() => {
        function norm(s) {
          if (!s) return "";
          return s
            .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
            .trim();
        }
        const rows = Array.from(
          document.querySelectorAll("table tbody tr, table tr"),
        );
        const payments = rows
          .map((r) => {
            const cells = Array.from(r.querySelectorAll("td")).map((c) =>
              norm(c.textContent || c.innerText),
            );
            if (cells.length >= 4 && cells[0]) {
              return {
                receiptNo: cells[0],
                date: cells[1],
                amount: parseFloat(cells[2]) || 0,
                description: cells[3],
              };
            }
            return null;
          })
          .filter(Boolean);
        return payments;
      });

      if (extractedFin && extractedFin.length > 0) {
        liveFinancial.payments = extractedFin;
        liveFinancial.hasPortalData = true;
      }
    } catch {}

    if (!studentName || studentName.includes("رقم") || studentName.length < 3) {
      studentName = `طالب جامعي (${actualStudentId})`;
    }

    const studentRecord = {
      studentId: actualStudentId,
      studentName,
      cohortYear: resolvedCohort,
      majorId: cleanMajorKey,
      majorName,
      college: cleanMajorRecord.college,
      degree: resolvedDegree,
      academicStatus: academicStatus || "منتظم",
      academicAdvisor: academicAdvisor || "غير محدد",
      academicWarning: academicWarning || "لا يوجد",
      currentSemester: currentSemester || "الفصل الحالي",
      financialBalance: financialBalance || "0",
      earnedCredits,
      totalCredits: finalTotalCredits,
      gpa,
      courseGrades,
      planCourses: coursesWithStatus,
      passedCourseIds: Array.from(passedCourseIds),
      registeredCourseIds: Array.from(registeredCourseIds),
      failedCourseIds: Array.from(failedCourseIds),
      remainingCourseIds: coursesWithStatus
        .filter((c) => c.status === "remaining")
        .map((c) => c.id),
      enrolledCourses,
      semesters: structuredSemesters,
      transactions: liveTransactions,
      financial: liveFinancial,
      exemptionExams,
      categoryRequirements: calculatedCategoryReqs,
      isLiveEdugate: true,
      lastSyncedAt: new Date().toISOString(),
    };

    // Attach salted password hash for instant 0-second authentication on future logins
    if (rawPassword) {
      studentRecord.authHash = hashStudentPassword(rawPassword);
    }

    saveStudentRecord(actualStudentId, studentRecord);
    if (normId !== actualStudentId) {
      saveStudentRecord(normId, studentRecord);
    }

    console.log(
      `✅ تمت مزامنة الطالب (${studentName || actualStudentId}) بنجاح: ${passedCourseIds.size} مادة مجتازة، ${registeredCourseIds.size} مسجلة حالياً، معدل: ${gpa}.`,
    );

    return studentRecord;
  } catch (err) {
    console.error(
      `⚠️ خطأ أثناء مزامنة بيانات الطالب (${normId}): ${err.message}`,
    );

    // If it is an authentication error (e.g., bad credentials or user locked out),
    // rethrow directly so the student receives immediate, clear feedback!
    const isAuthError =
      err.message?.includes("بيانات الدخول غير صحيحة") ||
      err.message?.includes("كلمة المرور") ||
      err.message?.includes("اسم المستخدم") ||
      err.message?.includes("الرقم الجامعي");

    if (isAuthError) {
      throw err;
    }

    // Check if we already have a previously synchronized real student record in the database
    const existingSaved = getStudentRecord(normId);
    if (existingSaved && existingSaved.isLiveEdugate) {
      // If student provided password and it does not match their stored hash, do not return cached data
      if (
        rawPassword &&
        existingSaved.authHash &&
        !verifyStudentPassword(rawPassword, existingSaved.authHash)
      ) {
        throw new Error(
          "بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم أو الرقم الجامعي وكلمة المرور.",
        );
      }
      console.log(
        `📦 استرجاع آخر نسخة محفوظة للطالب (${normId}) من قاعدة البيانات.`,
      );
      existingSaved.note =
        "تعذر الاتصال المباشر بالبوابة حالياً؛ تم تحميل آخر بيانات معتمدة تم سحبها لسجلك الأكاديمي.";
      return {
        ...existingSaved,
        fromCache: true,
      };
    }

    // Only use mock demo fallback if demoMode was explicitly requested!
    if (options.demoMode || normId === "demo" || rawPassword === "demo") {
      const fallback = buildCohortCurriculumAndProgress(normId);
      fallback.note =
        "تم تفعيل الخطة المعتمدة للدفعة وحساب المواد المنجزة احتياطياً.";
      saveStudentRecord(normId, fallback);
      return fallback;
    }

    // Never return mock "طالب تجريبي" for a live student login failure!
    throw new Error(
      `تعذر استكمال سحب البيانات من بوابة الطالب: ${err.message}`,
    );
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
}
