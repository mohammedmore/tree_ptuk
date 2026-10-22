import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertCatalogCourses, upsertMajor, getSyncStatus, updateSyncStatus } from "./db.js";
import { INITIAL_MAJORS } from "./majorsData.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract courses from src/data.ts using regex to avoid TypeScript compilation issues
function extractCoursesFromDataTs() {
  const dataTsPath = join(__dirname, "..", "src", "data.ts");
  const content = readFileSync(dataTsPath, "utf8");

  const coursesMatch = content.match(/export const courses:\s*Course\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!coursesMatch) {
    throw new Error("Could not find 'export const courses' in src/data.ts");
  }

  const rawCoursesBlock = coursesMatch[1];
  const courseRegex = /\{[\s\S]*?id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?prerequisites:\s*(\[[^\]]*\])[\s\S]*?credits:\s*(\d+)[\s\S]*?category:\s*"([^"]+)"([\s\S]*?)\}/g;

  const courses = [];
  let match;

  while ((match = courseRegex.exec(rawCoursesBlock)) !== null) {
    const [, id, name, prereqsRaw, credits, category, rest] = match;

    let prerequisites = [];
    try {
      prerequisites = JSON.parse(prereqsRaw.replace(/'/g, '"'));
    } catch {
      prerequisites = (prereqsRaw.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
    }

    const coPrereqsMatch = rest.match(/coPrerequisites:\s*(\[[^\]]*\])/);
    let coPrerequisites = [];
    if (coPrereqsMatch) {
      try {
        coPrerequisites = JSON.parse(coPrereqsMatch[1].replace(/'/g, '"'));
      } catch {
        coPrerequisites = (coPrereqsMatch[1].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
      }
    }

    const seasonalMatch = rest.match(/seasonal:\s*"([^"]+)"/);
    const seasonal = seasonalMatch ? seasonalMatch[1] : undefined;

    const minCreditsMatch = rest.match(/minCredits:\s*(\d+)/);
    const minCredits = minCreditsMatch ? Number(minCreditsMatch[1]) : undefined;

    courses.push({
      id,
      code: id,
      name,
      prerequisites,
      coPrerequisites,
      credits: Number(credits),
      category,
      seasonal,
      minCredits,
    });
  }

  return courses;
}

// Extract recommended semesters and common names from constants.ts
function extractConstants() {
  const constPath = join(__dirname, "..", "src", "constants.ts");
  const content = readFileSync(constPath, "utf8");

  const commonNames = {};
  const commonNamesMatch = content.match(/export const courseCommonNames:\s*Record<string, string>\s*=\s*\{([\s\S]*?)\};/);
  if (commonNamesMatch) {
    const lines = commonNamesMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (m) commonNames[m[1]] = m[2];
    }
  }

  const recommendedSemesters = {};
  const recMatch = content.match(/export const courseRecommendedSemesters:\s*Record<string, string>\s*=\s*\{([\s\S]*?)\};/);
  if (recMatch) {
    const lines = recMatch[1].split("\n");
    for (const line of lines) {
      const m = line.match(/"([^"]+)":\s*"([^"]+)"/);
      if (m) recommendedSemesters[m[1]] = m[2];
    }
  }

  return { commonNames, recommendedSemesters };
}

// Generate realistic lecture and lab schedule sections
function generateStandardSections(course) {
  const isLab = course.name.includes("مختبر") || course.name.includes("عملي");
  const instructors = ["د. محمد إبراهيم", "د. أحمد عمر", "أ. فاطمة سعيد", "د. سامر خليل", "أ. ليلى حسن"];
  const rooms = ["B201", "B204", "E105", "C302", "Lab-3", "Lab-4", "D101"];

  const instIndex = Math.abs(hashCode(course.id)) % instructors.length;
  const roomIndex = Math.abs(hashCode(course.id)) % rooms.length;

  if (isLab) {
    return [
      {
        sec: "1",
        instructor: instructors[instIndex],
        room: `Lab-${(roomIndex % 5) + 1}`,
        building: "مبنى الهندسة",
        status: "مفتوحة",
        blocks: [
          {
            days: ["الأحد"],
            start: 11,
            end: 14,
            rawTime: "11:00 - 14:00",
          },
        ],
      },
      {
        sec: "2",
        instructor: instructors[(instIndex + 1) % instructors.length],
        room: `Lab-${((roomIndex + 1) % 5) + 1}`,
        building: "مبنى الهندسة",
        status: "مفتوحة",
        blocks: [
          {
            days: ["الثلاثاء"],
            start: 14,
            end: 17,
            rawTime: "14:00 - 17:00",
          },
        ],
      },
    ];
  }

  return [
    {
      sec: "1",
      instructor: instructors[instIndex],
      room: rooms[roomIndex],
      building: "مبنى الهندسة والتكنولوجيا",
      status: "مفتوحة",
      blocks: [
        {
          days: ["الأحد", "الثلاثاء", "الخميس"],
          start: 8.5,
          end: 9.5,
          rawTime: "08:30 - 09:30",
        },
      ],
    },
    {
      sec: "2",
      instructor: instructors[(instIndex + 1) % instructors.length],
      room: rooms[(roomIndex + 1) % rooms.length],
      building: "مبنى الهندسة والتكنولوجيا",
      status: "مفتوحة",
      blocks: [
        {
          days: ["الاثنين", "الأربعاء"],
          start: 9.5,
          end: 11,
          rawTime: "09:30 - 11:00",
        },
      ],
    },
    {
      sec: "3",
      instructor: instructors[(instIndex + 2) % instructors.length],
      room: rooms[(roomIndex + 2) % rooms.length],
      building: "مبنى الهندسة والتكنولوجيا",
      status: "مفتوحة",
      blocks: [
        {
          days: ["الأحد", "الثلاثاء", "الخميس"],
          start: 12.5,
          end: 13.5,
          rawTime: "12:30 - 13:30",
        },
      ],
    },
  ];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export async function seedDatabase() {
  console.log("🌱 Seeding database from curricula and constants...");
  const cseCourses = extractCoursesFromDataTs();
  const { commonNames, recommendedSemesters } = extractConstants();

  const enrichedCseCourses = cseCourses.map((c) => ({
    ...c,
    commonName: commonNames[c.id] || null,
    recommendedSemester: recommendedSemesters[c.id] || "السنة الأولى - الفصل الأول",
    sections: generateStandardSections(c),
  }));

  // Upsert all CSE courses into catalog
  const catalogResult = await upsertCatalogCourses(
    enrichedCseCourses.map((c) => ({
      code: c.id,
      name: c.name,
      type: c.category,
      sections: c.sections,
    })),
  );

  // Seed CSE major
  upsertMajor({
    ...INITIAL_MAJORS.find((m) => m.id === "cse"),
    courses: enrichedCseCourses,
  });

  // Seed SWE major (Software Engineering)
  const sweCourses = enrichedCseCourses
    .filter((c) => !c.name.includes("مجسات") && !c.name.includes("سيركت 2"))
    .concat([
      {
        id: "12140430",
        code: "12140430",
        name: "هندسة المتطلبات والمواصفات",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140418"],
        recommendedSemester: "السنة الثالثة - الفصل الأول",
        sections: generateStandardSections({ id: "12140430", name: "هندسة المتطلبات والمواصفات" }),
      },
      {
        id: "12140431",
        code: "12140431",
        name: "معمارية البرمجيات وأنماطها",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140418"],
        recommendedSemester: "السنة الثالثة - الفصل الثاني",
        sections: generateStandardSections({ id: "12140431", name: "معمارية البرمجيات وأنماطها" }),
      },
      {
        id: "12140432",
        code: "12140432",
        name: "فحص البرمجيات وضمان الجودة (QA)",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140418"],
        recommendedSemester: "السنة الرابعة - الفصل الأول",
        sections: generateStandardSections({ id: "12140432", name: "فحص البرمجيات وضمان الجودة" }),
      },
      {
        id: "12140433",
        code: "12140433",
        name: "الحوسبة السحابية وDevOps",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140308", "12140312"],
        recommendedSemester: "السنة الرابعة - الفصل الثاني",
        sections: generateStandardSections({ id: "12140433", name: "الحوسبة السحابية وDevOps" }),
      },
    ]);

  upsertMajor({
    ...INITIAL_MAJORS.find((m) => m.id === "swe"),
    courses: sweCourses,
  });

  // Seed CS major (Computer Science)
  const csCourses = enrichedCseCourses
    .filter((c) => !c.category.includes("كلية إجباري") || c.name.includes("كالكولس") || c.name.includes("فيزياء 1"))
    .slice(0, 50)
    .concat([
      {
        id: "12140360",
        code: "12140360",
        name: "نظرية الحوسبة واللغات الصورية",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140204"],
        recommendedSemester: "السنة الثانية - الفصل الثاني",
        sections: generateStandardSections({ id: "12140360", name: "نظرية الحوسبة" }),
      },
      {
        id: "12140361",
        code: "12140361",
        name: "بناء المترجمات (Compilers)",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140360"],
        recommendedSemester: "السنة الثالثة - الفصل الأول",
        sections: generateStandardSections({ id: "12140361", name: "بناء المترجمات" }),
      },
      {
        id: "12140362",
        code: "12140362",
        name: "أمن المعلومات والتشفير",
        credits: 3,
        category: "متطلب تخصص إجباري",
        prerequisites: ["12140205", "12140312"],
        recommendedSemester: "السنة الثالثة - الفصل الثاني",
        sections: generateStandardSections({ id: "12140362", name: "أمن المعلومات والتشفير" }),
      },
    ]);

  upsertMajor({
    ...INITIAL_MAJORS.find((m) => m.id === "cs"),
    courses: csCourses,
  });

  // Seed EE major
  upsertMajor({
    ...INITIAL_MAJORS.find((m) => m.id === "ee"),
    courses: enrichedCseCourses.filter((c) =>
      c.name.includes("سيركت") ||
      c.name.includes("إلكترونيات") ||
      c.name.includes("إشارات") ||
      c.name.includes("تحكم") ||
      c.category.includes("جامعة") ||
      c.category.includes("كلية"),
    ),
  });

  // Update sync status
  updateSyncStatus({
    lastSyncTime: new Date().toISOString(),
    lastSyncStatus: "success",
    totalCourses: catalogResult.totalCourses,
    totalSections: catalogResult.insertedSections,
    totalBlocks: catalogResult.insertedSections * 2,
    durationSeconds: 1.2,
  });

  console.log(`✅ Seeded ${catalogResult.totalCourses} courses across ${INITIAL_MAJORS.length} majors into db.json.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedDatabase().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
}
