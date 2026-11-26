import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEATURE_TOUR_STEPS,
  type FeatureTourStep,
} from "../src/core/featureTour";
import type { AppRoute } from "../src/router";

const pageFiles: Partial<Record<AppRoute, URL>> = {
  plan: new URL("../src/pages/PlanPage.tsx", import.meta.url),
  "semester-planning": new URL(
    "../src/pages/SemesterPlanningPage.tsx",
    import.meta.url,
  ),
  courses: new URL("../src/pages/CoursesPage.tsx", import.meta.url),
  schedule: new URL("../src/pages/WeeklySchedulePage.tsx", import.meta.url),
  gpa: new URL("../src/pages/GPAPage.tsx", import.meta.url),
  login: new URL("../src/pages/LoginPage.tsx", import.meta.url),
  registration: new URL("../src/App.tsx", import.meta.url),
};

test("feature tour ids are unique across pages", () => {
  const ids = Object.values(FEATURE_TOUR_STEPS).flatMap(
    (steps) => steps?.map((step: FeatureTourStep) => step.id) ?? [],
  );

  assert.equal(new Set(ids).size, ids.length);
});

test("every feature tour step has a target in its page", () => {
  for (const [route, steps] of Object.entries(FEATURE_TOUR_STEPS)) {
    const pageFile = pageFiles[route as AppRoute];
    assert.ok(pageFile, `Missing page mapping for route "${route}"`);

    const source = readFileSync(pageFile, "utf8");
    const targetIds = new Set(
      Array.from(source.matchAll(/data-feature-tour="([^"]+)"/g))
        .flatMap(([, value]) => value.split(/\s+/))
        .filter(Boolean),
    );

    for (const step of steps ?? []) {
      assert.ok(
        targetIds.has(step.id),
        `Missing target "${step.id}" in route "${route}"`,
      );
    }
  }
});
