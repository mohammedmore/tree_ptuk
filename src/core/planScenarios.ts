export interface PlanScenario {
  id: string;
  name: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
  plannedCourses: Record<string, string>;
  selectedElectives?: Record<string, string>;
}

const STORAGE_SCENARIOS_KEY = "ptuk_plan_scenarios_v2";
const LEGACY_STORAGE_KEY = "ptuk_plan_scenarios_v1";
const STORAGE_ACTIVE_SCENARIO_KEY = "ptuk_active_scenario_id";

export const PRESET_SCENARIOS: PlanScenario[] = [
  {
    id: "default-standard",
    name: "الخطة القياسية (4 سنوات)",
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: "الخطة المعتادة بتسجيل 17-18 ساعة في كل فصل بدون صيفي",
    plannedCourses: {},
  },
  {
    id: "balanced-5yr",
    name: "الخطة المخففة (5 سنوات)",
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: "توزيع مخفف بمتوسط 14-15 ساعة فصلياً لتخفيف العبء الأكاديمي",
    plannedCourses: {},
  },
  {
    id: "summer-accelerated",
    name: "الخطة المسرعة (مع الفصول الصيفية)",
    version: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    description: "استغلال الفصول الصيفية لتسريع التخرج وتخفيف الفصول العادية",
    plannedCourses: {},
  },
];

/**
 * Validates and migrates raw scenarios to ensure data integrity
 */
export function sanitizeScenarios(scenarios: unknown[]): PlanScenario[] {
  if (!Array.isArray(scenarios)) return PRESET_SCENARIOS;

  const valid: PlanScenario[] = [];
  const now = new Date().toISOString();

  for (const raw of scenarios) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<PlanScenario>;
    if (!item.id || typeof item.id !== "string") continue;
    if (!item.name || typeof item.name !== "string") continue;

    const plannedCourses: Record<string, string> = {};
    if (item.plannedCourses && typeof item.plannedCourses === "object") {
      for (const [k, v] of Object.entries(item.plannedCourses)) {
        if (
          typeof k === "string" &&
          typeof v === "string" &&
          k.trim() &&
          v.trim()
        ) {
          plannedCourses[k.trim()] = v.trim();
        }
      }
    }

    const selectedElectives: Record<string, string> = {};
    if (item.selectedElectives && typeof item.selectedElectives === "object") {
      for (const [k, v] of Object.entries(item.selectedElectives)) {
        if (
          typeof k === "string" &&
          typeof v === "string" &&
          k.trim() &&
          v.trim()
        ) {
          selectedElectives[k.trim()] = v.trim();
        }
      }
    }

    valid.push({
      id: item.id,
      name: item.name.trim(),
      version: 2,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
      description: item.description,
      plannedCourses,
      selectedElectives:
        Object.keys(selectedElectives).length > 0
          ? selectedElectives
          : undefined,
    });
  }

  return valid.length > 0 ? valid : PRESET_SCENARIOS;
}

export function getStoredScenarios(): PlanScenario[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return PRESET_SCENARIOS;
  }

  try {
    const rawV2 = window.localStorage.getItem(STORAGE_SCENARIOS_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      return sanitizeScenarios(parsed);
    }

    // Attempt migration from v1
    const rawV1 = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      const migrated = sanitizeScenarios(parsedV1);
      window.localStorage.setItem(
        STORAGE_SCENARIOS_KEY,
        JSON.stringify(migrated),
      );
      return migrated;
    }
  } catch {
    // fallback
  }

  return PRESET_SCENARIOS;
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function saveScenario(
  nameOrScenario: string | PlanScenario,
  plannedCourses: Record<string, string> = {},
  selectedElectives?: Record<string, string>,
  description?: string,
): PlanScenario {
  const current = getStoredScenarios();

  if (typeof nameOrScenario === "object" && nameOrScenario !== null) {
    const sc = nameOrScenario as PlanScenario;
    const existingIdx = current.findIndex((s) => s.id === sc.id);
    let next: PlanScenario[];
    if (existingIdx >= 0) {
      next = [...current];
      next[existingIdx] = sc;
    } else {
      next = [...current, sc];
    }
    safeSetItem(STORAGE_SCENARIOS_KEY, JSON.stringify(next));
    safeSetItem(STORAGE_ACTIVE_SCENARIO_KEY, sc.id);
    return sc;
  }

  const name = nameOrScenario as string;
  const id = `scenario-${Date.now()}`;
  const now = new Date().toISOString();

  const newScenario: PlanScenario = {
    id,
    name: name.trim() || `سيناريو ${current.length + 1}`,
    version: 2,
    createdAt: now,
    updatedAt: now,
    description,
    plannedCourses: { ...plannedCourses },
    selectedElectives: selectedElectives ? { ...selectedElectives } : undefined,
  };

  let next = [...current, newScenario];

  // Point 34: LRU Eviction - cap custom scenarios at 15 to prevent unbounded storage inflation
  const customScenarios = next.filter(
    (s) => !PRESET_SCENARIOS.some((p) => p.id === s.id),
  );
  if (customScenarios.length > 15) {
    customScenarios.sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    );
    const toRemoveId = customScenarios[0].id;
    next = next.filter((s) => s.id !== toRemoveId);
  }

  safeSetItem(STORAGE_SCENARIOS_KEY, JSON.stringify(next));
  safeSetItem(STORAGE_ACTIVE_SCENARIO_KEY, id);

  return newScenario;
}

export function updateScenario(
  id: string,
  plannedCourses: Record<string, string>,
  selectedElectives?: Record<string, string>,
): void {
  const current = getStoredScenarios();
  const index = current.findIndex((s) => s.id === id);
  if (index === -1) return;

  current[index] = {
    ...current[index],
    version: 2,
    updatedAt: new Date().toISOString(),
    plannedCourses: { ...plannedCourses },
    selectedElectives: selectedElectives
      ? { ...selectedElectives }
      : current[index].selectedElectives,
  };

  safeSetItem(STORAGE_SCENARIOS_KEY, JSON.stringify(current));
}

export function duplicateScenario(id: string): PlanScenario | null {
  const current = getStoredScenarios();
  const source = current.find((s) => s.id === id);
  if (!source) return null;

  return saveScenario(
    `${source.name} (نسخة)`,
    source.plannedCourses,
    source.selectedElectives,
    source.description,
  );
}

export function renameScenario(id: string, newName: string): boolean {
  if (!newName || !newName.trim()) return false;
  const current = getStoredScenarios();
  const target = current.find((s) => s.id === id);
  if (!target) return false;

  target.name = newName.trim();
  target.updatedAt = new Date().toISOString();

  return safeSetItem(STORAGE_SCENARIOS_KEY, JSON.stringify(current));
}

export function deleteScenario(id: string): PlanScenario[] {
  const current = getStoredScenarios();
  const next = current.filter((s) => s.id !== id);
  const finalScenarios = next.length > 0 ? next : PRESET_SCENARIOS;

  safeSetItem(STORAGE_SCENARIOS_KEY, JSON.stringify(finalScenarios));
  const activeId = getActiveScenarioId();
  if (activeId === id) {
    safeSetItem(STORAGE_ACTIVE_SCENARIO_KEY, finalScenarios[0].id);
  }
  return finalScenarios;
}

export function getActiveScenarioId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return PRESET_SCENARIOS[0].id;
  }
  try {
    return (
      window.localStorage.getItem(STORAGE_ACTIVE_SCENARIO_KEY) ||
      PRESET_SCENARIOS[0].id
    );
  } catch {
    return PRESET_SCENARIOS[0].id;
  }
}

export function setActiveScenarioId(id: string): void {
  safeSetItem(STORAGE_ACTIVE_SCENARIO_KEY, id);
}

/**
 * Encodes a PlanScenario into a portable, shareable code (Base64 URL-safe string)
 */
export function exportScenarioToShareCode(scenario: PlanScenario): string {
  const payload = {
    v: 2,
    n: scenario.name,
    p: scenario.plannedCourses,
    e: scenario.selectedElectives,
  };
  try {
    const jsonStr = JSON.stringify(payload);
    if (typeof btoa !== "undefined") {
      return `PTUK-PLAN-${btoa(encodeURIComponent(jsonStr))}`;
    }
    return `PTUK-PLAN-${Buffer.from(encodeURIComponent(jsonStr)).toString("base64")}`;
  } catch {
    return "";
  }
}

/**
 * Decodes a shareable code back into a PlanScenario
 */
export function importScenarioFromShareCode(code: string): PlanScenario | null {
  if (!code || typeof code !== "string" || !code.startsWith("PTUK-PLAN-"))
    return null;
  const rawBase64 = code.replace("PTUK-PLAN-", "").trim();
  try {
    let decodedJson = "";
    if (typeof atob !== "undefined") {
      try {
        decodedJson = decodeURIComponent(atob(rawBase64));
      } catch {
        decodedJson = atob(rawBase64);
      }
    } else if (typeof Buffer !== "undefined") {
      try {
        decodedJson = decodeURIComponent(
          Buffer.from(rawBase64, "base64").toString("binary"),
        );
      } catch {
        decodedJson = Buffer.from(rawBase64, "base64").toString("utf8");
      }
    }
    const data = JSON.parse(decodedJson);
    if (!data || !data.p || typeof data.p !== "object") return null;

    return {
      id: `imported-${Date.now()}`,
      name: data.n ? `${data.n} (مستورد)` : "خطة مستوردة",
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plannedCourses: data.p || {},
      selectedElectives: data.e || undefined,
    };
  } catch {
    return null;
  }
}
