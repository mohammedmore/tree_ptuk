import assert from "node:assert/strict";
import test from "node:test";
import { parseExemptionExamRows } from "../server/services/exemptionExamParser.js";

test("records only course codes explicitly listed as exempted by Edugate", () => {
  const { exemptionExams, passedCourseCodes } = parseExemptionExamRows([
    {
      examName: "امتحان مستوى اللغة الإنجليزية",
      semester: "20241",
      exemptedCoursesRaw: "15200106",
      passedRaw: "",
      cells: ["امتحان مستوى اللغة الإنجليزية", "20241", "15200106"],
    },
  ]);

  assert.deepEqual([...passedCourseCodes], ["15200106"]);
  assert.deepEqual(
    exemptionExams.map(({ code }) => code),
    ["15200106"],
  );
  assert.equal(exemptionExams[0].isPassed, true);
});

test("does not infer exemptions from a score, exam name, or another course", () => {
  const { exemptionExams, passedCourseCodes } = parseExemptionExamRows([
    {
      examName: "امتحان مستوى اللغة الإنجليزية",
      semester: "20241",
      exemptedCoursesRaw: "",
      passedRaw: "ناجح",
      cells: ["امتحان مستوى اللغة الإنجليزية", "20241", "85", "ناجح"],
    },
  ]);

  assert.equal(exemptionExams.length, 0);
  assert.equal(passedCourseCodes.size, 0);
});

test("keeps explicitly failed exemption rows out of passed courses", () => {
  const { exemptionExams, passedCourseCodes } = parseExemptionExamRows([
    {
      examName: "امتحان مستوى",
      exemptedCoursesRaw: "13010006",
      passedRaw: "راسب",
      text: "امتحان مستوى 13010006 راسب",
    },
  ]);

  assert.equal(exemptionExams[0].isPassed, false);
  assert.equal(passedCourseCodes.size, 0);
});
