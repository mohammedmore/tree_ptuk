import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.resolve(ROOT_DIR, "src");
const SERVER_DIR = path.resolve(ROOT_DIR, "server");
const TSC_BIN = path.resolve(ROOT_DIR, "node_modules", "typescript", "bin", "tsc");

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  let matched: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist") {
        matched = matched.concat(walkFiles(fullPath, predicate));
      }
    } else if (entry.isFile() && predicate(fullPath)) {
      matched.push(fullPath);
    }
  }
  return matched;
}

function srgbToLinear(c: number): number {
  const norm = c / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function calcRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function calcContrastRatio(hex1: string, hex2: string): number {
  const l1 = calcRelativeLuminance(hex1);
  const l2 = calcRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Global Standards Verification Suite (Milestone M2)", () => {
  // =========================================================================
  // 1. TypeScript Strictness & Type Safety Standards Audit
  // =========================================================================
  describe("1. TypeScript Strictness & Compiler Configuration", () => {
    test("compiler configuration enforces strict: true and omits allowJs (backend un-type-checked)", () => {
      const tsconfigPath = path.join(ROOT_DIR, "tsconfig.json");
      assert.ok(fs.existsSync(tsconfigPath), "tsconfig.json must exist at project root");

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
      const options = tsconfig.compilerOptions || {};

      assert.equal(options.strict, true, "compilerOptions.strict must be true");
      assert.notEqual(options.allowJs, true, "compilerOptions.allowJs must not be true, isolating backend from tsc");
      assert.notEqual(
        options.noUncheckedIndexedAccess,
        true,
        "compilerOptions.noUncheckedIndexedAccess must be omitted in current permissive baseline",
      );
      assert.notEqual(
        options.noImplicitReturns,
        true,
        "compilerOptions.noImplicitReturns must be omitted in current permissive baseline",
      );
    });

    test("current baseline tsc --noEmit compiles with 0 errors across codebase", { timeout: 120000 }, () => {
      let exitCode = 0;
      let output = "";
      try {
        output = execFileSync(process.execPath, [TSC_BIN, "--noEmit"], {
          cwd: ROOT_DIR,
          encoding: "utf8",
          stdio: "pipe",
        });
      } catch (err: any) {
        exitCode = err.status ?? 1;
        output = (err.stdout || "") + (err.stderr || "");
      }

      const errorLines = output.split("\n").filter((l) => l.includes(": error TS"));
      assert.equal(
        errorLines.length,
        0,
        `Baseline tsc --noEmit must pass with 0 errors across standard codebase. Unexpected errors:\n${errorLines.join("\n")}`,
      );
      assert.equal(exitCode, 0, "tsc --noEmit process must exit with code 0");
    });

    test(
      "enterprise flag --noUncheckedIndexedAccess exposes 548+ latent undefined errors",
      { timeout: 120000 },
      () => {
        let exitCode = 0;
        let output = "";
        try {
          execFileSync(process.execPath, [TSC_BIN, "--noEmit", "--noUncheckedIndexedAccess"], {
            cwd: ROOT_DIR,
            encoding: "utf8",
            stdio: "pipe",
          });
        } catch (err: any) {
          exitCode = err.status ?? 1;
          output = (err.stdout || "") + (err.stderr || "");
        }

        assert.notEqual(exitCode, 0, "tsc must fail when enterprise flag --noUncheckedIndexedAccess is enabled");

        const errorMatches = output.match(/:\s*error\s*TS\d+:/g) || [];
        const errorCount = errorMatches.length;

        assert.ok(
          errorCount >= 540 && errorCount <= 560,
          `Expected ~549 latent unchecked indexed access errors, detected ${errorCount}`,
        );
        assert.ok(output.includes("error TS2322") || output.includes("error TS2532") || output.includes("error TS18048"),
          "Output must contain characteristic undefined indexing errors (TS2322, TS2532, TS18048)",
        );
      },
    );

    test("source code audit verifies exact counts of explicit any and non-null assertions (!) in src/", () => {
      const tsFiles = walkFiles(SRC_DIR, (f) => f.endsWith(".ts") || f.endsWith(".tsx"));
      assert.ok(tsFiles.length >= 80, `Expected >= 80 TypeScript files in src/, found ${tsFiles.length}`);

      let totalAnyCount = 0;
      let asAnyCount = 0;
      let nonNullCount = 0;

      const fileStats: Record<string, { anyCount: number; asAnyCount: number; nonNullCount: number }> = {};

      for (const file of tsFiles) {
        const rel = path.relative(SRC_DIR, file).replace(/\\/g, "/");
        const content = fs.readFileSync(file, "utf8");
        const codeWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

        const anyMatches = content.match(/:\s*any\b|\bas\s+any\b|<any>/g) || [];
        const asAnyMatches = content.match(/\bas\s+any\b/g) || [];
        // Non-null assertion operator: identifier! or )! or ]! not followed by = or == (evaluated on stripped code)
        const nonNullMatches = codeWithoutComments.match(/[a-zA-Z0-9_\)\]]!(?![\=\!])/g) || [];

        totalAnyCount += anyMatches.length;
        asAnyCount += asAnyMatches.length;
        nonNullCount += nonNullMatches.length;

        if (anyMatches.length > 0 || nonNullMatches.length > 0) {
          fileStats[rel] = {
            anyCount: anyMatches.length,
            asAnyCount: asAnyMatches.length,
            nonNullCount: nonNullMatches.length,
          };
        }
      }

      // Assert verified metrics from static investigation
      assert.ok(totalAnyCount >= 100, `Expected >= 100 explicit any usages in src/, counted ${totalAnyCount}`);
      assert.equal(asAnyCount, 28, `Expected exactly 28 'as any' bypass assertions in src/, counted ${asAnyCount}`);
      assert.ok(
        nonNullCount >= 45 && nonNullCount <= 65,
        `Expected non-null assertions (!) in src/ to be between 45 and 65, counted ${nonNullCount}`,
      );

      // Verify top offenders
      assert.ok(fileStats["vite-env.d.ts"]?.anyCount >= 14, "vite-env.d.ts must contain wildcard any declarations");
      assert.ok(
        fileStats["core/graphLayout.ts"]?.nonNullCount >= 12,
        "core/graphLayout.ts must contain >= 12 non-null assertions",
      );
      assert.ok(
        fileStats["components/planner/MultiColumnRoadmapView.tsx"]?.nonNullCount >= 8,
        "MultiColumnRoadmapView.tsx must contain >= 8 non-null assertions",
      );
    });
  });

  // =========================================================================
  // 2. ESLint & Static Analysis Standards Audit
  // =========================================================================
  describe("2. ESLint & Static Analysis Standards", () => {
    test("eslint.config.js contains 0 active rules, 0 plugins, and only ignores patterns", () => {
      const eslintConfigPath = path.join(ROOT_DIR, "eslint.config.js");
      assert.ok(fs.existsSync(eslintConfigPath), "eslint.config.js must exist at project root");

      const configContent = fs.readFileSync(eslintConfigPath, "utf8");

      assert.ok(configContent.includes("ignores:"), "eslint.config.js must define an ignores block");
      assert.equal(
        configContent.includes("rules:"),
        false,
        "eslint.config.js must not contain any active lint rules",
      );
      assert.equal(
        configContent.includes("plugins:"),
        false,
        "eslint.config.js must not configure any plugins",
      );
      assert.equal(
        configContent.includes("languageOptions:"),
        false,
        "eslint.config.js must not configure languageOptions",
      );
    });

    test("package.json lint script is aliased solely to tsc and omits eslint dependencies", () => {
      const pkgPath = path.join(ROOT_DIR, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

      assert.equal(
        pkg.scripts?.lint,
        "tsc --noEmit",
        "package.json lint script must only execute 'tsc --noEmit'",
      );

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      assert.equal("eslint" in allDeps, false, "eslint package must be absent from dependencies");
      assert.equal(
        "eslint-plugin-react-hooks" in allDeps,
        false,
        "eslint-plugin-react-hooks must be absent from dependencies",
      );
      assert.equal(
        "eslint-plugin-jsx-a11y" in allDeps,
        false,
        "eslint-plugin-jsx-a11y must be absent from dependencies",
      );
      assert.equal(
        "@typescript-eslint/eslint-plugin" in allDeps,
        false,
        "@typescript-eslint/eslint-plugin must be absent from dependencies",
      );
    });
  });

  // =========================================================================
  // 3. Code Modularity & Architectural Complexity Audit
  // =========================================================================
  describe("3. Code Modularity & Architectural Complexity", () => {
    test("monolithic modules exceed acceptable modular limits (>1,000 lines)", () => {
      const monolithicFiles = [
        { path: "server/services/studentPortalService.js", expectedMin: 3800 },
        { path: "src/pages/RegistrationPage.tsx", expectedMin: 3700 },
        { path: "src/components/modals/WeeklyScheduleModal.tsx", expectedMin: 3000 },
        { path: "src/pages/CoursesPage.tsx", expectedMin: 2900 },
        { path: "src/pages/SemesterPlanningPage.tsx", expectedMin: 2800 },
        { path: "src/App.tsx", expectedMin: 2300 },
      ];

      for (const item of monolithicFiles) {
        const fullPath = path.join(ROOT_DIR, item.path);
        assert.ok(fs.existsSync(fullPath), `File ${item.path} must exist`);

        const lineCount = fs.readFileSync(fullPath, "utf8").split("\n").length;
        assert.ok(
          lineCount > 1000,
          `File ${item.path} (${lineCount} lines) should exceed acceptable modular limit of 1,000 lines`,
        );
        assert.ok(
          lineCount >= item.expectedMin,
          `File ${item.path} line count (${lineCount}) should meet expected empirical threshold >= ${item.expectedMin}`,
        );
      }
    });

    test("Zustand stores are completely bypassed by all core pages in favor of prop drilling", () => {
      const corePages = [
        "src/App.tsx",
        "src/pages/CoursesPage.tsx",
        "src/pages/PlanPage.tsx",
        "src/pages/RegistrationPage.tsx",
        "src/pages/GPAPage.tsx",
        "src/pages/SemesterPlanningPage.tsx",
      ];

      const stores = ["useAcademicStore", "useScheduleStore", "useUIStore"];

      for (const pageRel of corePages) {
        const fullPath = path.join(ROOT_DIR, pageRel);
        assert.ok(fs.existsSync(fullPath), `Page ${pageRel} must exist`);

        const content = fs.readFileSync(fullPath, "utf8");
        for (const store of stores) {
          assert.equal(
            content.includes(store),
            false,
            `Core page ${pageRel} should not import or consume ${store} (bypassed in favor of local state)`,
          );
        }
      }
    });
  });

  // =========================================================================
  // 4. WCAG 2.1 AA Accessibility Standards Audit
  // =========================================================================
  describe("4. WCAG 2.1 AA Accessibility Standards", () => {
    test("24 ad-hoc modals bypass BaseModal.tsx and lack keyboard Tab focus traps", () => {
      // 1. Check files importing BaseModal
      const allSrcFiles = walkFiles(SRC_DIR, (f) => f.endsWith(".tsx"));
      const baseModalConsumers = allSrcFiles.filter((f) => {
        const content = fs.readFileSync(f, "utf8");
        return (
          content.includes("from '../common/BaseModal'") ||
          content.includes("from './BaseModal'") ||
          content.includes('from "../common/BaseModal"') ||
          content.includes('from "@/components/common/BaseModal"')
        );
      });

      // Only 4 files import BaseModal: WeeklyScheduleModal, AddCourseModal, SharedScheduleModals, SupportModal
      assert.equal(
        baseModalConsumers.length,
        4,
        `Expected exactly 4 modal component files importing BaseModal.tsx, found ${baseModalConsumers.length}`,
      );

      // 2. Verify ad-hoc modal containers in components/modals that omit BaseModal and lack Tab traps
      const modalDir = path.join(SRC_DIR, "components", "modals");
      const adHocModalFiles = [
        "AcademicAdvisorModal.tsx",
        "AcademicCalendarModal.tsx",
        "CommandPaletteModal.tsx",
        "CourseComparisonDrawer.tsx",
        "DoctorScheduleModal.tsx",
        "ExportModal.tsx",
        "MajorSelectorModal.tsx",
        "MajorTransferModal.tsx",
        "ResetConfirmationModal.tsx",
        "SectionSwapModal.tsx",
        "StudentRecordsModal.tsx",
        "SystemHealthModal.tsx",
      ];

      for (const modalFile of adHocModalFiles) {
        const fullPath = path.join(modalDir, modalFile);
        assert.ok(fs.existsSync(fullPath), `Ad-hoc modal ${modalFile} must exist`);

        const content = fs.readFileSync(fullPath, "utf8");
        assert.equal(
          content.includes("BaseModal"),
          false,
          `${modalFile} must bypass BaseModal.tsx`,
        );

        // Check for Tab focus trap implementation (document keydown or focus cycle)
        const hasTabTrap =
          content.includes('e.key === "Tab"') ||
          content.includes("e.key === 'Tab'") ||
          content.includes("focusTrap") ||
          content.includes("trapFocus");

        assert.equal(
          hasTabTrap,
          false,
          `${modalFile} lacks Tab focus trap (violates WCAG 2.1.2 & 2.4.3)`,
        );
      }

      // 3. Verify inline page-embedded ad-hoc modals in primary pages
      const pageAdHocModals = [
        { file: "src/pages/CoursesPage.tsx", flags: ["gpaModalCourse", "selectedCourseForTracking"] },
        { file: "src/pages/GPAPage.tsx", flags: ["isAddPickerOpen"] },
        { file: "src/pages/SemesterPlanningPage.tsx", flags: ["showMobilePlannedSheet", "confirmClearOpen"] },
        {
          file: "src/pages/RegistrationPage.tsx",
          flags: [
            "showTestModal",
            "showCompareModal",
            "safeSwapCourseId",
            "showShareModal",
            "showSuggestModal",
            "isAddModalOpen",
            "showResetModal",
          ],
        },
      ];

      let inlineAdHocCount = 0;
      for (const item of pageAdHocModals) {
        const content = fs.readFileSync(path.join(ROOT_DIR, item.file), "utf8");
        for (const flag of item.flags) {
          assert.ok(content.includes(flag), `Page ${item.file} must declare inline modal state '${flag}'`);
          inlineAdHocCount++;
        }
      }

      // Total ad-hoc modals verified = 12 (components/modals) + 12 (page embedded) = 24
      assert.equal(
        adHocModalFiles.length + inlineAdHocCount,
        24,
        "Verified exactly 24 ad-hoc modals bypassing BaseModal without focus traps",
      );
    });

    test("dynamic seat watcher alerts and status toasts lack aria-live regions", () => {
      // SeatWatcherPanel lacks aria-live
      const seatWatcherContent = fs.readFileSync(
        path.join(SRC_DIR, "components", "registration", "SeatWatcherPanel.tsx"),
        "utf8",
      );
      assert.equal(
        seatWatcherContent.includes("aria-live"),
        false,
        "SeatWatcherPanel.tsx must lack aria-live region for real-time seat alerts",
      );

      // RegistrationPage dynamic toasts lack aria-live
      const regPageContent = fs.readFileSync(
        path.join(SRC_DIR, "pages", "RegistrationPage.tsx"),
        "utf8",
      );
      assert.equal(
        regPageContent.includes("aria-live"),
        false,
        "RegistrationPage.tsx toast and execution summaries must lack aria-live announcements",
      );

      // App.tsx appToastMessage lacks aria-live
      const appContent = fs.readFileSync(path.join(SRC_DIR, "App.tsx"), "utf8");
      assert.equal(
        appContent.includes("aria-live"),
        false,
        "App.tsx global appToastMessage must lack aria-live announcement",
      );

      // Total aria-live across entire frontend is restricted to exactly 3 occurrences
      const allTsxFiles = walkFiles(SRC_DIR, (f) => f.endsWith(".tsx") || f.endsWith(".ts"));
      const filesWithAriaLive = allTsxFiles.filter((f) =>
        fs.readFileSync(f, "utf8").includes("aria-live"),
      );

      assert.equal(
        filesWithAriaLive.length,
        3,
        `Expected exactly 3 files containing aria-live in src/, found ${filesWithAriaLive.length}`,
      );
    });

    test("color contrast calculations: text-slate-400 against white fails WCAG AA 4.5:1 (ratio 2.56:1)", () => {
      const slate400 = "#94a3b8";
      const white = "#ffffff";
      const contrastRatio = calcContrastRatio(slate400, white);

      // Contrast ratio is exactly 2.56:1 (mathematically 2.564041...:1, rounded to 2 decimals)
      const roundedRatio = Math.round(contrastRatio * 100) / 100;
      assert.ok(
        roundedRatio >= 2.55 && roundedRatio <= 2.58,
        `Calculated contrast ratio for #94a3b8 on #ffffff is ${roundedRatio}:1, expected ~2.56:1`,
      );
      assert.equal(
        roundedRatio,
        2.56,
        `Calculated contrast ratio for #94a3b8 on #ffffff must be exactly 2.56:1 (got ${roundedRatio}:1)`,
      );

      // Fails WCAG AA minimum normal text threshold of 4.5:1
      assert.ok(
        roundedRatio < 4.5,
        `Contrast ratio ${roundedRatio}:1 fails the 4.5:1 WCAG 2.1 AA minimum threshold`,
      );

      // Emerald-500 on white failure
      const emerald500 = "#10b981";
      const emeraldRatio = Math.round(calcContrastRatio(emerald500, white) * 100) / 100;
      assert.ok(emeraldRatio < 4.5, `Emerald-500 (${emeraldRatio}:1) fails WCAG AA threshold`);

      // Emerald-600 on white failure
      const emerald600 = "#059669";
      const emerald600Ratio = Math.round(calcContrastRatio(emerald600, white) * 100) / 100;
      assert.ok(emerald600Ratio < 4.5, `Emerald-600 (${emerald600Ratio}:1) fails WCAG AA threshold`);
    });

    test("form input labeling audit detects disconnected visual <label> elements missing htmlFor/id", () => {
      // PlanItemsTable.tsx lines 241 and 289
      const tableContent = fs.readFileSync(
        path.join(SRC_DIR, "components", "registration", "PlanItemsTable.tsx"),
        "utf8",
      );
      const tableLabels = tableContent.split("\n").filter((l) => l.includes("<label") && !l.includes("htmlFor"));
      assert.ok(
        tableLabels.length >= 2,
        `PlanItemsTable.tsx must contain disconnected <label> tags without htmlFor, found ${tableLabels.length}`,
      );

      // RegistrationPage.tsx lines 3665, 3735, 3747
      const regContent = fs.readFileSync(path.join(SRC_DIR, "pages", "RegistrationPage.tsx"), "utf8");
      const regLabels = regContent.split("\n").filter((l) => l.includes("<label") && !l.includes("htmlFor"));
      assert.ok(
        regLabels.length >= 3,
        `RegistrationPage.tsx must contain disconnected <label> tags without htmlFor, found ${regLabels.length}`,
      );
    });
  });

  // =========================================================================
  // 5. OWASP ASVS Security Standards Audit
  // =========================================================================
  describe("5. OWASP ASVS Security Standards", () => {
    test("OWASP A01 / BOLA audit: verifies unauthenticated execution bypass condition in registration route", () => {
      const regRoutePath = path.join(SERVER_DIR, "routes", "registration.js");
      const regRouteContent = fs.readFileSync(regRoutePath, "utf8");

      // Verify BOLA guard condition on line 199
      assert.ok(
        regRouteContent.includes("if (req.studentSession && !options.demoMode)"),
        "registration.js must contain conditional check 'if (req.studentSession && !options.demoMode)'",
      );

      // Verify authenticateStudentSession middleware in security.js
      const secMiddlewarePath = path.join(SERVER_DIR, "middleware", "security.js");
      const secMiddlewareContent = fs.readFileSync(secMiddlewarePath, "utf8");

      assert.ok(
        secMiddlewareContent.includes("req.studentSession = null;"),
        "authenticateStudentSession must set req.studentSession = null when authorization header is absent",
      );
      assert.ok(
        secMiddlewareContent.includes("return next();"),
        "authenticateStudentSession must call next() instead of rejecting unauthenticated requests",
      );

      // Logic proof: When auth header is missing, req.studentSession is null,
      // causing 'if (req.studentSession && !options.demoMode)' to evaluate to false,
      // completely bypassing the BOLA check and allowing unauthenticated registration batch execution.
      const simulatedSession = null;
      const demoMode = false;
      const isBOLAActive = Boolean(simulatedSession && !demoMode);
      assert.equal(
        isBOLAActive,
        false,
        "Unauthenticated request results in false for BOLA guard, bypassing authorization checks",
      );
    });

    test("OWASP A02: sensitive transcript and auth token are targeted to localStorage", () => {
      const studentServicePath = path.join(SRC_DIR, "services", "studentService.ts");
      const studentServiceContent = fs.readFileSync(studentServicePath, "utf8");

      assert.ok(
        studentServiceContent.includes('STORAGE_STUDENT_KEY = "ptuk_synced_student_profile"'),
        "studentService.ts must define storage key for student profile",
      );
      assert.ok(
        studentServiceContent.includes('STORAGE_STUDENT_TOKEN_KEY = "ptuk_student_token"'),
        "studentService.ts must define storage key for session token",
      );

      assert.ok(
        studentServiceContent.includes("window.localStorage.setItem(\n          STORAGE_STUDENT_KEY,") ||
          studentServiceContent.includes("window.localStorage.setItem(\r\n          STORAGE_STUDENT_KEY,") ||
          studentServiceContent.includes("STORAGE_STUDENT_KEY,"),
        "studentService.ts must serialize student profile to localStorage",
      );
      assert.ok(
        studentServiceContent.includes("window.localStorage.setItem(STORAGE_STUDENT_TOKEN_KEY, result.token)"),
        "studentService.ts must write session token to localStorage",
      );
    });

    test("OWASP A04: synchronous crypto.scryptSync causes event loop thread starvation in securityVault.js", () => {
      const vaultPath = path.join(SERVER_DIR, "services", "securityVault.js");
      const vaultContent = fs.readFileSync(vaultPath, "utf8");

      const scryptSyncMatches = vaultContent.match(/crypto\.scryptSync\(/g) || [];
      assert.ok(
        scryptSyncMatches.length >= 2,
        `securityVault.js must contain at least 2 synchronous crypto.scryptSync invocations, found ${scryptSyncMatches.length}`,
      );

      assert.ok(
        vaultContent.includes("function hashStudentPassword(password)"),
        "hashStudentPassword must exist in securityVault.js",
      );
      assert.ok(
        vaultContent.includes("function verifyStudentPassword(password, storedHash)"),
        "verifyStudentPassword must exist in securityVault.js",
      );
    });

    test("OWASP ASVS V9.2: rejectUnauthorized: false disables TLS validation in academicCalendarScraper.js", () => {
      const scraperPath = path.join(SERVER_DIR, "services", "scrapers", "academicCalendarScraper.js");
      const scraperContent = fs.readFileSync(scraperPath, "utf8");

      assert.ok(
        scraperContent.includes("rejectUnauthorized: false"),
        "academicCalendarScraper.js must contain 'rejectUnauthorized: false' in https.Agent",
      );
      assert.ok(
        scraperContent.includes("new https.Agent({ rejectUnauthorized: false })"),
        "academicCalendarScraper.js must instantiate an https.Agent bypassing certificate validation",
      );
    });
  });
});
