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
} from "../db.js";
import {
  AI_CURRICULUM_COURSES,
  AI_CATEGORY_REQUIREMENTS,
} from "../majorsData.js";
import { hashStudentPassword, verifyStudentPassword } from "./securityVault.js";
import { edugateCircuitBreaker } from "../utils/circuitBreaker.js";
import {
  EDUGATE_PLAN_SOURCE,
  normalizeEdugateMajorPlan,
} from "./majorPlanParser.js";
import { parseExemptionExamRows } from "./exemptionExamParser.js";
export { parseExemptionExamRows };
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
    (course) => course.status === "completed",
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

let sharedBrowser = null;
let browserIdleTimer = null;
const BROWSER_IDLE_TIMEOUT_MS = 3 * 60 * 1000;

function resetBrowserIdleTimer() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(() => {
    closeSharedBrowser();
  }, BROWSER_IDLE_TIMEOUT_MS);
  if (browserIdleTimer.unref) browserIdleTimer.unref();
}

async function getSharedBrowser() {
  resetBrowserIdleTimer();
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
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
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

  // Demo plans are available only when explicitly requested.
  if (options.demoMode || normId === "demo" || normId.startsWith("demo_")) {
    const data = buildCohortCurriculumAndProgress(normId);
    saveStudentRecord(normId, data);
    return data;
  }
  if (!rawPassword) {
    throw new Error("كلمة مرور بوابة الجامعة مطلوبة لمزامنة الخطة.");
  }

  // ─── 0-Second Fast Cached Authentication ───────────────────────
  // If the student has previously logged in and we have their verified record + password hash,
  // we verify credentials instantly in 0ms without launching a 20-second Playwright session!
  if (!options.forceLive && rawPassword) {
    const existing = getStudentRecord(normId);
    if (
      existing &&
      existing.planSource === EDUGATE_PLAN_SOURCE &&
      Array.isArray(existing.planCourses) &&
      existing.planCourses.length > 0 &&
      existing.authHash &&
      verifyStudentPassword(rawPassword, existing.authHash)
    ) {
      console.log("⚡ [FAST CACHE] استرجاع فوري لسجل الطالب من الكاش.");
      return {
        ...existing,
        fromCache: true,
      };
    }
  }

  // ─── Upstream Circuit Breaker Check ─────────────────────────────
  const circuitCheck = edugateCircuitBreaker.canExecute();
  if (!circuitCheck.allowed) {
    throw new Error(circuitCheck.reason);
  }

  let context;
  let page;

  try {
    console.log("🔐 محاولة تسجيل الدخول عبر بوابة خضوري Edugate...");
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
    const currentSemester = currentSemesterMatch
      ? currentSemesterMatch[1].trim()
      : "";

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
      domMetadata.academicStatus || (statusMatch ? statusMatch[1].trim() : "");

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
    let academicWarning = warningMatch ? warningMatch[1].trim() : "";

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

    for (const semTable of chronologicalTables) {
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
        const isExplicitRegistered =
          /(مسجل|قيد الدراسة|registered|enrolled)/i.test(statusText);

        const isPassed = isExplicitPass && !isExplicitFail;
        const isFailed = isExplicitFail;
        const isRegistered =
          isExplicitRegistered &&
          !/(غير مسجل|not registered)/i.test(statusText);

        const resolvedStatus = isPassed
          ? statusText
          : isFailed
            ? statusText
            : isRegistered
              ? statusText
              : "غير متاح";

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
        } else if (isPassed && courseGrades[code] === undefined) {
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
                exemptedCoursesRaw: "",
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
        if (courseGrades[code] === undefined) {
          courseGrades[code] = -1;
        }
      }
    } catch (examErr) {
      console.warn(`⚠️ تعذر جلب صفحة امتحانات الإعفاء: ${examErr.message}`);
    }

    // 3.7. Scrape Major Plan (/student/majorPlan)
    let scrapedPlanCourses = [];
    let scrapedMajorCategoryRequirements = {};
    let scrapedMajorTotalCredits = 0;
    let scrapedPlanSource = "";
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

        function categoryFromText(text) {
          const mandatory = text.includes("إجباري") || text.includes("إجبارية");
          const elective =
            text.includes("اختياري") || text.includes("اختيارية");
          if (
            text.includes("متطلب جامعة") ||
            text.includes("متطلبات جامعة") ||
            text.includes("متطلبات الجامعة")
          ) {
            if (mandatory) return "متطلب جامعة إجباري";
            if (elective) return "متطلب جامعة اختياري";
          }
          if (
            text.includes("متطلب كلية") ||
            text.includes("متطلبات كلية") ||
            text.includes("متطلبات الكلية")
          ) {
            if (mandatory) return "متطلب كلية إجباري";
            if (elective) return "متطلب كلية اختياري";
          }
          if (
            text.includes("متطلب تخصص") ||
            text.includes("متطلبات تخصص") ||
            text.includes("متطلبات التخصص")
          ) {
            if (mandatory) return "متطلب تخصص إجباري";
            if (elective) return "متطلب تخصص اختياري";
          }
          if (text.includes("استدراكي") && mandatory) {
            return "متطلب استدراكي إجباري";
          }
          return "";
        }

        const results = [];
        const seenCodes = new Set();
        let currentCategory = "غير مصنف";
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

          currentCategory = categoryFromText(headerContext) || "غير مصنف";

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
              currentCategory =
                categoryFromText(fullRowText) || currentCategory;
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
              name = nameCandidate || "";
            }
            name = name.replace(/^اسم\s*المقرر\s*/, "").trim();

            // Extract credits
            let creditsText = "";
            if (
              colMap.credits !== -1 &&
              /^\d+(?:\.\d+)?$/.test(cells[colMap.credits] || "")
            ) {
              creditsText = cells[colMap.credits];
            } else {
              const credCandidate = cells.find(
                (c) =>
                  c !== code &&
                  /^\d+(?:\.\d+)?$/.test(c) &&
                  Number(c) >= 0 &&
                  Number(c) <= 12,
              );
              creditsText = credCandidate || "";
            }
            const credits = creditsText ? Number(creditsText) : null;

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
            rowCategory = categoryFromText(fullRowText) || rowCategory;

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
                const hasCourseCode = /\b\d{6,8}\b/.test(text);
                const matchedCat = categoryFromText(text);

                if (matchedCat && !hasCourseCode) {
                  const hoursMatch = text.match(
                    /(\d{1,3})\s*(?:ساعة|ساعات|س\.م)/,
                  );
                  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                  if (hours >= 1 && hours <= 140) {
                    scrapedCategoryRequirements[matchedCat] = hours;
                  }
                }

                if (
                  !hasCourseCode &&
                  (text.includes("المجموع") ||
                    text.includes("الإجمالي") ||
                    text.includes("إجمالي الساعات") ||
                    text.includes("مجموع الساعات"))
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

            const matchedCat = categoryFromText(headerText);

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
        const normalizedPlan = normalizeEdugateMajorPlan(scrapedPlanResult);
        scrapedPlanCourses = normalizedPlan.courses;
        scrapedMajorCategoryRequirements = normalizedPlan.categoryRequirements;
        scrapedMajorTotalCredits = normalizedPlan.totalDegreeCredits;
        scrapedPlanSource = normalizedPlan.source;
      } else {
        throw new Error("تعذر قراءة الخطة الاسترشادية من بوابة الجامعة.");
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
    if (
      scrapedPlanSource !== EDUGATE_PLAN_SOURCE ||
      !scrapedPlanCourses.length
    ) {
      throw new Error(
        "تعذر التحقق من الخطة الاسترشادية في بوابة الجامعة؛ لم يتم استخدام خطة ثابتة أو تخمينية.",
      );
    }

    // 4. Match with the major explicitly identified by Edugate, if present.
    const majorId = majorName ? slugifyMajor(majorName) : "";

    console.log(
      `📋 تم التحقق من الخطة المسحوبة من بوابة الطالب (${scrapedPlanCourses.length} مادة).`,
    );
    const baseCourses = scrapedPlanCourses;

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
        credits: course.credits,
        category: course.category,
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
        if (!semCourse) continue;
        coursesWithStatus.push({
          id: code,
          code,
          name: semCourse.name,
          credits: semCourse.credits,
          category: "غير مصنف",
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

    const planCoursesWithStatus = coursesWithStatus.filter((course) =>
      baseCourseIds.has(course.id),
    );
    const completedCourses = planCoursesWithStatus.filter(
      (course) => course.status === "completed",
    );
    const earnedCredits = completedCourses.reduce((sum, c) => {
      if (String(c.category || "").includes("استدراكي")) return sum;
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
          c.grade !== -1 &&
          Number.isFinite(c.credits) &&
          c.credits > 0
        ) {
          totalQualityPoints += c.grade * c.credits;
          totalGpaHours += c.credits;
        }
      }
      gpa =
        totalGpaHours > 0
          ? parseFloat((totalQualityPoints / totalGpaHours).toFixed(2))
          : null;
    }

    // Clean General Curriculum Courses (without student marks or completion flags)
    const cleanGeneralCourses = planCoursesWithStatus.map((course) => ({
      id: course.id,
      code: course.code || course.id,
      name: course.name,
      credits: Number(course.credits),
      category: course.category,
      prerequisites: Array.isArray(course.prerequisites)
        ? course.prerequisites
        : [],
      coPrerequisites: Array.isArray(course.coPrerequisites)
        ? course.coPrerequisites
        : [],
      seasonal: course.seasonal || "both",
      semester: course.semester || course.recommendedSemester,
      recommendedSemester: course.recommendedSemester || course.semester,
    }));

    const resolvedDegree = scrapedDegree;

    const calculatedCategoryReqs = {
      ...scrapedMajorCategoryRequirements,
    };
    for (const c of cleanGeneralCourses) {
      const cat = c.category;
      if (!cat.includes("اختياري") && !calculatedCategoryReqs[cat]) {
        calculatedCategoryReqs[cat] =
          (calculatedCategoryReqs[cat] || 0) + (c.credits || 0);
      }
    }

    const unresolvedCategoryRequirement = cleanGeneralCourses.some(
      (course) =>
        course.category === "غير مصنف" ||
        (course.category.includes("اختياري") &&
          !Number.isFinite(calculatedCategoryReqs[course.category])),
    );
    const calculatedTotalCredits = Object.entries(
      calculatedCategoryReqs,
    ).reduce((sum, [cat, cr]) => {
      if (cat.includes("استدراكي")) return sum;
      return sum + cr;
    }, 0);

    const finalTotalCredits =
      scrapedMajorTotalCredits > 0 && scrapedMajorTotalCredits <= 260
        ? scrapedMajorTotalCredits
        : !unresolvedCategoryRequirement &&
            calculatedTotalCredits > 0 &&
            calculatedTotalCredits <= 260
          ? calculatedTotalCredits
          : 0;

    const cleanMajorKey = majorId;

    // The transcript does not identify a student's registered section.
    const enrolledCourses = [];

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
                status: cells[3] || "",
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

    const liveFinancial = {
      balance: financialBalance || "",
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
              const amount = Number(cells[2].replace(/,/g, ""));
              if (!Number.isFinite(amount)) return null;
              return {
                receiptNo: cells[0],
                date: cells[1],
                amount,
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

    const studentRecord = {
      studentId: actualStudentId,
      studentName: studentName || "",
      cohortYear: "",
      majorId: cleanMajorKey,
      majorName,
      college,
      degree: resolvedDegree,
      academicStatus,
      academicAdvisor,
      academicWarning,
      currentSemester,
      financialBalance,
      earnedCredits,
      totalCredits: finalTotalCredits,
      planSource: scrapedPlanSource,
      gpa,
      courseGrades,
      planCourses: planCoursesWithStatus,
      passedCourseIds: Array.from(passedCourseIds),
      registeredCourseIds: Array.from(registeredCourseIds),
      failedCourseIds: Array.from(failedCourseIds),
      remainingCourseIds: planCoursesWithStatus
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
      `✅ تمت مزامنة السجل بنجاح: ${passedCourseIds.size} مادة مجتازة، ${registeredCourseIds.size} مسجلة حالياً، معدل: ${gpa}.`,
    );

    edugateCircuitBreaker.recordSuccess();
    return studentRecord;
  } catch (err) {
    edugateCircuitBreaker.recordFailure(err);
    console.error(`⚠️ خطأ أثناء مزامنة بيانات الطالب: ${err.message}`);

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
    if (
      existingSaved?.isLiveEdugate &&
      existingSaved.planSource === EDUGATE_PLAN_SOURCE &&
      Array.isArray(existingSaved.planCourses) &&
      existingSaved.planCourses.length > 0
    ) {
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
      console.log("📦 استرجاع آخر نسخة محفوظة من قاعدة البيانات.");
      existingSaved.note =
        "تعذر الاتصال المباشر بالبوابة حالياً؛ تم تحميل آخر بيانات معتمدة تم سحبها لسجلك الأكاديمي.";
      return {
        ...existingSaved,
        fromCache: true,
      };
    }
    if (
      existingSaved?.isLiveEdugate &&
      existingSaved.planSource !== EDUGATE_PLAN_SOURCE
    ) {
      throw new Error(
        "الخطة المحفوظة قديمة أو غير موثقة من بوابة الجامعة؛ أعد المزامنة بعد عودة الاتصال.",
      );
    }

    // Only use mock demo fallback if demoMode was explicitly requested!
    if (options.demoMode || normId === "demo" || normId.startsWith("demo_")) {
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
