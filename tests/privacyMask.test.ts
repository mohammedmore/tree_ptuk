import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("CSS rules for privacy-sensitive include blur and disable user-select", () => {
  const cssPath = path.resolve(process.cwd(), "src/styles/index.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  assert.ok(
    cssContent.includes(".privacy-sensitive"),
    "index.css must contain .privacy-sensitive class rules",
  );
  assert.ok(
    cssContent.includes("filter: blur(8px) !important;"),
    "privacy mask must apply filter: blur(8px)",
  );
  assert.ok(
    cssContent.includes("user-select: none !important;"),
    "privacy mask must disable text selection",
  );
  assert.ok(
    cssContent.includes("-webkit-user-select: none !important;"),
    "privacy mask must disable webkit text selection",
  );
  assert.ok(
    cssContent.includes("pointer-events: none !important;"),
    "privacy mask must disable pointer events to prevent inspection/copying",
  );
  assert.ok(cssContent.includes("@media print"), "print view must be handled");
  assert.ok(
    cssContent.includes("filter: none !important;"),
    "print view must unblur for official printouts",
  );
});

test("StudentPortalModal marks sensitive student info as privacy-sensitive", () => {
  const portalModalPath = path.resolve(
    process.cwd(),
    "src/components/modals/StudentPortalModal.tsx",
  );
  const content = fs.readFileSync(portalModalPath, "utf-8");

  assert.ok(
    content.includes("privacy-sensitive"),
    "StudentPortalModal must contain privacy-sensitive classes",
  );
  assert.ok(
    content.includes("usePrivacyMask"),
    "StudentPortalModal must use usePrivacyMask hook",
  );
  assert.ok(
    content.includes("syncedProfile.studentName"),
    "StudentPortalModal renders studentName",
  );
  assert.ok(
    content.includes("syncedProfile.studentId"),
    "StudentPortalModal renders studentId",
  );
  assert.ok(
    content.includes("syncedProfile.financialBalance"),
    "StudentPortalModal renders financialBalance",
  );
  assert.ok(
    content.includes("syncedProfile.academicAdvisor"),
    "StudentPortalModal renders academicAdvisor",
  );
  assert.ok(
    content.includes("syncedProfile.academicWarning"),
    "StudentPortalModal renders academicWarning",
  );
});

test("StudentRecordsModal marks sensitive records with privacy-sensitive", () => {
  const recordsModalPath = path.resolve(
    process.cwd(),
    "src/components/modals/StudentRecordsModal.tsx",
  );
  const content = fs.readFileSync(recordsModalPath, "utf-8");

  assert.ok(
    content.includes("privacy-sensitive"),
    "StudentRecordsModal must contain privacy-sensitive classes",
  );
  assert.ok(
    content.includes("usePrivacyMask"),
    "StudentRecordsModal must use usePrivacyMask hook",
  );
  assert.ok(
    content.includes("profile?.studentName"),
    "StudentRecordsModal renders studentName",
  );
  assert.ok(
    content.includes("profile?.studentId"),
    "StudentRecordsModal renders studentId",
  );
  assert.ok(
    content.includes("financial.balance"),
    "StudentRecordsModal renders financial.balance",
  );
});

test("ExportModal marks student identity as privacy-sensitive", () => {
  const exportModalPath = path.resolve(
    process.cwd(),
    "src/components/modals/ExportModal.tsx",
  );
  const content = fs.readFileSync(exportModalPath, "utf-8");

  assert.ok(
    content.includes("privacy-sensitive"),
    "ExportModal must contain privacy-sensitive class",
  );
});

test("AcademicAuditPrint marks student identity as privacy-sensitive on screen", () => {
  const auditPath = path.resolve(
    process.cwd(),
    "src/components/planner/AcademicAuditPrint.tsx",
  );
  const content = fs.readFileSync(auditPath, "utf-8");

  assert.ok(
    content.includes("privacy-sensitive"),
    "AcademicAuditPrint must tag student data as privacy-sensitive",
  );
});

test("RegistrationPage marks student financial balance as privacy-sensitive", () => {
  const regPath = path.resolve(process.cwd(), "src/pages/RegistrationPage.tsx");
  const content = fs.readFileSync(regPath, "utf-8");

  assert.ok(
    content.includes("financialBalance"),
    "RegistrationPage checks financialBalance",
  );
  assert.ok(
    content.includes("privacy-sensitive"),
    "RegistrationPage tags financial balance as privacy-sensitive",
  );
});

test("privacyMaskStore toggles cleanly and can be turned off reliably", async () => {
  const {
    setPrivacyMask,
    togglePrivacyMask,
    getPrivacyMask,
    subscribePrivacyMask,
  } = await import("../src/services/privacyMaskStore.ts");

  let notifyCount = 0;
  const unsubscribe = subscribePrivacyMask(() => {
    notifyCount++;
  });

  // Force true
  setPrivacyMask(true);
  assert.equal(
    getPrivacyMask(),
    true,
    "Must be true after setPrivacyMask(true)",
  );

  // Toggle to false (can turn off!)
  const stateAfterToggle = togglePrivacyMask();
  assert.equal(
    stateAfterToggle,
    false,
    "togglePrivacyMask must turn off when active",
  );
  assert.equal(getPrivacyMask(), false, "getPrivacyMask must return false");

  // Toggle back to true
  const stateAfterSecondToggle = togglePrivacyMask();
  assert.equal(
    stateAfterSecondToggle,
    true,
    "togglePrivacyMask must turn on when inactive",
  );
  assert.equal(getPrivacyMask(), true, "getPrivacyMask must return true");

  // Turn off again
  setPrivacyMask(false);
  assert.equal(
    getPrivacyMask(),
    false,
    "Must turn off when setPrivacyMask(false)",
  );

  unsubscribe();
  assert.ok(
    notifyCount >= 3,
    "Subscribers must be notified on state transitions",
  );
});
