import { Position, type Node, type Edge } from "@xyflow/react";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 64;
export const HORIZONTAL_GAP = 88;
export const VERTICAL_GAP = 12;
export const HEADER_OFFSET_Y = 44;

export type LayoutMode = "prerequisite" | "catalog" | "planned";

export interface LayoutOptions {
  nodes: Node[];
  edges: Edge[];
  courseSemesterMap?: Record<string, number>; // courseId -> 0-indexed semester column
  layoutMode?: LayoutMode;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  totalColumns: number;
  columnHeaders: Array<{
    column: number;
    title: string;
    totalCredits: number;
    courseCount: number;
    x: number;
    y: number;
    width: number;
  }>;
}

export interface CriticalPathChain {
  id: string;
  name: string;
  length: number;
  courseIds: string[];
  edgeIds: string[];
  terminalCourseId: string;
  terminalCourseName: string;
  isGraduationCapstone: boolean;
}

export interface CriticalPathResult {
  courseIds: Set<string>;
  edgeIds: Set<string>;
  orderedCourseIds: string[];
  paths: CriticalPathChain[];
  maxChainLength: number;
}

/**
 * Computes multiple prerequisite chains leading to graduation capstone and major milestones (Multiple Critical Paths).
 * Discovers distinct bottleneck branches so students don't miss parallel critical prerequisite tracks.
 */
export function computeCriticalPath(
  courses: Array<{
    id: string;
    name?: string;
    prerequisites?: string[];
    isGraduationProject?: boolean;
    minCredits?: number;
  }>,
): CriticalPathResult {
  if (!courses || courses.length === 0) {
    return {
      courseIds: new Set(),
      edgeIds: new Set(),
      orderedCourseIds: [],
      paths: [],
      maxChainLength: 0,
    };
  }

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const reverseAdjacency = new Map<string, string[]>(); // course -> prereqs
  const forwardAdjacency = new Map<string, string[]>(); // course -> dependents

  courses.forEach((c) => {
    reverseAdjacency.set(c.id, []);
    forwardAdjacency.set(c.id, []);
  });

  courses.forEach((c) => {
    (c.prerequisites || []).forEach((pId) => {
      if (courseMap.has(pId)) {
        reverseAdjacency.get(c.id)!.push(pId);
        forwardAdjacency.get(pId)!.push(c.id);
      }
    });
  });

  // Calculate distance from root (longest sequential chain from any root course)
  const distFromRootMemo = new Map<string, number>();
  function getDistFromRoot(id: string, visited = new Set<string>()): number {
    if (distFromRootMemo.has(id)) return distFromRootMemo.get(id)!;
    if (visited.has(id)) return 1; // cycle protection

    visited.add(id);
    const prereqs = reverseAdjacency.get(id) || [];
    if (prereqs.length === 0) {
      distFromRootMemo.set(id, 1);
      return 1;
    }

    let maxPrereqDist = 0;
    for (const p of prereqs) {
      const d = getDistFromRoot(p, new Set(visited));
      if (d > maxPrereqDist) maxPrereqDist = d;
    }

    const dist = maxPrereqDist + 1;
    distFromRootMemo.set(id, dist);
    return dist;
  }

  courses.forEach((c) => getDistFromRoot(c.id));

  // Helper to identify graduation capstones
  const isCapstone = (c: {
    id: string;
    name?: string;
    isGraduationProject?: boolean;
    minCredits?: number;
  }) =>
    Boolean(
      c.isGraduationProject ||
      c.name?.includes("مشروع تخرج") ||
      c.name?.includes("مشروع التخرج") ||
      (c.minCredits && c.minCredits >= 100) ||
      c.id === "12140524" ||
      c.id === "19041492",
    );

  const capstoneCourses = courses.filter(isCapstone);
  let maxCapstoneLen = 0;
  capstoneCourses.forEach((c) => {
    const d = distFromRootMemo.get(c.id) || 1;
    if (d > maxCapstoneLen) maxCapstoneLen = d;
  });

  let globalMaxLen = 0;
  courses.forEach((c) => {
    const d = distFromRootMemo.get(c.id) || 1;
    if (d > globalMaxLen) globalMaxLen = d;
  });

  const benchmarkLength = maxCapstoneLen > 0 ? maxCapstoneLen : globalMaxLen;
  const criticalThreshold = Math.max(3, benchmarkLength - 1);

  // Collect terminal targets (capstones + leaves with depth >= criticalThreshold)
  const candidateTargets = courses
    .filter((c) => {
      const d = distFromRootMemo.get(c.id) || 1;
      const isLeaf = (forwardAdjacency.get(c.id) || []).length === 0;
      return (
        (isCapstone(c) && d >= criticalThreshold) ||
        (isLeaf && d >= criticalThreshold) ||
        d === benchmarkLength
      );
    })
    .sort((a, b) => {
      const aCap = isCapstone(a) ? 1 : 0;
      const bCap = isCapstone(b) ? 1 : 0;
      if (bCap !== aCap) return bCap - aCap;
      const distA = distFromRootMemo.get(a.id) || 0;
      const distB = distFromRootMemo.get(b.id) || 0;
      return distB - distA;
    });

  // Backtracking function to build optimal chains for a terminal node
  function extractChainsForTarget(targetId: string, maxChains = 3): string[][] {
    const results: string[][] = [];

    function backtrack(
      currId: string,
      currentChain: string[],
      visited: Set<string>,
    ) {
      if (results.length >= maxChains) return;
      if (visited.has(currId)) return;
      visited.add(currId);

      const prereqs = reverseAdjacency.get(currId) || [];
      if (prereqs.length === 0) {
        results.push([currId, ...currentChain]);
        return;
      }

      // Sort prereqs by descending distFromRoot to explore longest branches first
      const sortedPrereqs = [...prereqs].sort((p1, p2) => {
        return (
          (distFromRootMemo.get(p2) || 0) - (distFromRootMemo.get(p1) || 0)
        );
      });

      const maxPDist = distFromRootMemo.get(sortedPrereqs[0]) || 0;
      for (const p of sortedPrereqs) {
        const pDist = distFromRootMemo.get(p) || 0;
        if (pDist >= maxPDist - 1) {
          backtrack(p, [currId, ...currentChain], new Set(visited));
        }
      }
    }

    backtrack(targetId, [], new Set());
    return results;
  }

  // Extract distinct chains across candidate targets
  const rawDiscovered: CriticalPathChain[] = [];
  const seenPathSignatures = new Set<string>();

  for (const target of candidateTargets) {
    const rawChains = extractChainsForTarget(target.id, 2);
    for (const chain of rawChains) {
      if (chain.length < criticalThreshold) continue;
      const sig = chain.join("->");
      if (seenPathSignatures.has(sig)) continue;
      seenPathSignatures.add(sig);

      const targetCourse = courseMap.get(target.id);
      const isCap = isCapstone(targetCourse || target);

      // Create a descriptive Arabic title for this critical chain
      let chainName = targetCourse?.name || target.id;
      if (isCap) {
        const distinguishingCourse = chain.find((cId) => {
          const name = courseMap.get(cId)?.name || "";
          return (
            name.includes("برمجيات") ||
            name.includes("قواعد البيانات") ||
            name.includes("خوارزميات") ||
            name.includes("ذكاء") ||
            name.includes("تعلم الآلة") ||
            name.includes("شبكات") ||
            name.includes("اتصالات") ||
            name.includes("معمارية")
          );
        });
        const distName = distinguishingCourse
          ? courseMap.get(distinguishingCourse)?.name
          : "";
        chainName = distName
          ? `سلسلة مشروع التخرج (${distName})`
          : `سلسلة مشروع التخرج (${targetCourse?.name || "المسار الأساسي"})`;
      } else {
        chainName = `سلسلة ${targetCourse?.name || target.id}`;
      }

      const edgeIds: string[] = [];
      for (let i = 0; i < chain.length - 1; i++) {
        edgeIds.push(`e-${chain[i]}-${chain[i + 1]}`);
      }

      rawDiscovered.push({
        id: `crit-path-${rawDiscovered.length + 1}`,
        name: chainName,
        length: chain.length,
        courseIds: chain,
        edgeIds,
        terminalCourseId: target.id,
        terminalCourseName: targetCourse?.name || target.id,
        isGraduationCapstone: isCap,
      });

      if (rawDiscovered.length >= 10) break;
    }
    if (rawDiscovered.length >= 10) break;
  }

  // Filter out chains that are strict prefixes of longer chains
  const filteredPaths = rawDiscovered.filter((pathA) => {
    return !rawDiscovered.some(
      (pathB) =>
        pathB.id !== pathA.id &&
        pathB.length > pathA.length &&
        pathA.courseIds.every((cId, idx) => pathB.courseIds[idx] === cId),
    );
  });

  // Fallback: if no chains reached threshold, pick the single longest path
  if (filteredPaths.length === 0 && candidateTargets.length > 0) {
    const target = candidateTargets[0];
    const rawChains = extractChainsForTarget(target.id, 1);
    const chain = rawChains[0] || [target.id];
    const targetCourse = courseMap.get(target.id);
    const edgeIds: string[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      edgeIds.push(`e-${chain[i]}-${chain[i + 1]}`);
    }
    filteredPaths.push({
      id: "crit-path-1",
      name: `سلسلة ${targetCourse?.name || target.id}`,
      length: chain.length,
      courseIds: chain,
      edgeIds,
      terminalCourseId: target.id,
      terminalCourseName: targetCourse?.name || target.id,
      isGraduationCapstone: isCapstone(targetCourse || target),
    });
  }

  // Prioritize Capstone paths first, then longest paths
  filteredPaths.sort((p1, p2) => {
    if (p1.isGraduationCapstone !== p2.isGraduationCapstone) {
      return p1.isGraduationCapstone ? -1 : 1;
    }
    return p2.length - p1.length;
  });

  // Re-index IDs sequentially
  const finalPaths = filteredPaths.map((p, idx) => ({
    ...p,
    id: `crit-path-${idx + 1}`,
  }));

  const primaryChain = finalPaths[0] || {
    courseIds: [],
    edgeIds: [],
  };

  const allCourseIds = new Set<string>();
  const allEdgeIds = new Set<string>();
  finalPaths.forEach((p) => {
    p.courseIds.forEach((id) => allCourseIds.add(id));
    p.edgeIds.forEach((id) => allEdgeIds.add(id));
  });

  return {
    courseIds: allCourseIds,
    edgeIds: allEdgeIds,
    orderedCourseIds: primaryChain.courseIds,
    paths: finalPaths,
    maxChainLength: benchmarkLength,
  };
}

const SEMESTER_LABELS = [
  "السنة الأولى - الفصل الأول",
  "السنة الأولى - الفصل الثاني",
  "السنة الثانية - الفصل الأول",
  "السنة الثانية - الفصل الثاني",
  "السنة الثالثة - الفصل الأول",
  "السنة الثالثة - الفصل الثاني",
  "السنة الرابعة - الفصل الأول",
  "السنة الرابعة - الفصل الثاني",
  "السنة الخامسة - الفصل الأول",
  "السنة الخامسة - الفصل الثاني",
];

/**
 * Pure deterministic graph layout algorithm meeting all specifications:
 * 1. Columns based on plan semester or longest prerequisite chain.
 * 2. 4-pass Barycenter ordering to minimize edge crossings while preserving stability.
 * 3. 200px x 64px node dimensions, 88px inter-column spacing, 12px vertical spacing.
 * 4. RTL-aligned positions: Column 0 on the far right.
 */
// Point 21: In-memory layout cache to avoid recomputing Dagre / Barycenter passes unnecessarily
const layoutCache = new Map<string, LayoutResult>();

export function computeGraphLayout(options: LayoutOptions): LayoutResult {
  const {
    nodes,
    edges,
    courseSemesterMap = {},
    layoutMode = "catalog",
  } = options;
  if (nodes.length === 0) {
    return { nodes: [], edges: [], totalColumns: 0, columnHeaders: [] };
  }

  // Fast cache key computation
  const cacheKey = `${nodes.length}_${edges.length}_${layoutMode}_${Object.keys(courseSemesterMap).length}`;
  const cached = layoutCache.get(cacheKey);
  if (
    cached &&
    nodes.every((n, i) => cached.nodes[i] && cached.nodes[i].id === n.id)
  ) {
    return cached;
  }

  const nodeMap = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>(); // node -> target nodes
  const reverseAdjacency = new Map<string, string[]>(); // node -> source nodes

  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    reverseAdjacency.set(n.id, []);
  });

  edges.forEach((e) => {
    // Only strict prerequisite edges define topological ordering
    if ((e.data as Record<string, unknown> | undefined)?.isCoRequisite) return;
    if (adjacency.has(e.source) && reverseAdjacency.has(e.target)) {
      adjacency.get(e.source)!.push(e.target);
      reverseAdjacency.get(e.target)!.push(e.source);
    }
  });

  // Step 1: Assign Column Index to every node
  const nodeColumn = new Map<string, number>();

  // Helper: compute longest prerequisite chain length
  function getChainDepth(id: string, visited = new Set<string>()): number {
    if (visited.has(id)) return 0; // prevent cycle
    visited.add(id);
    const prereqs = reverseAdjacency.get(id) || [];
    if (prereqs.length === 0) return 0;
    return (
      1 + Math.max(...prereqs.map((p) => getChainDepth(p, new Set(visited))))
    );
  }

  nodes.forEach((n) => {
    if (
      typeof courseSemesterMap[n.id] === "number" &&
      courseSemesterMap[n.id] >= 0
    ) {
      nodeColumn.set(n.id, courseSemesterMap[n.id]);
    } else {
      nodeColumn.set(n.id, getChainDepth(n.id));
    }
  });

  // Ensure prerequisite dependencies always precede their dependents in column index
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    edges.forEach((e) => {
      if ((e.data as Record<string, unknown> | undefined)?.isCoRequisite)
        return;
      const srcCol = nodeColumn.get(e.source) ?? 0;
      const targetCol = nodeColumn.get(e.target) ?? 0;
      if (srcCol >= targetCol) {
        nodeColumn.set(e.target, srcCol + 1);
        changed = true;
      }
    });
  }

  const maxCol = Math.max(0, ...Array.from(nodeColumn.values()));
  const totalColumns = maxCol + 1;

  // Group nodes by column
  const columns: string[][] = Array.from({ length: totalColumns }, () => []);
  nodes.forEach((n) => {
    const col = nodeColumn.get(n.id) ?? 0;
    columns[col].push(n.id);
  });

  // Initial deterministic sort: Compulsory courses first (upper swimlane), Electives second (lower swimlane)
  columns.forEach((colList) => {
    colList.sort((a, b) => {
      const nodeA = nodeMap.get(a)!;
      const nodeB = nodeMap.get(b)!;
      const isElectiveA = (nodeA.data?.category as string)?.includes("اختياري")
        ? 1
        : 0;
      const isElectiveB = (nodeB.data?.category as string)?.includes("اختياري")
        ? 1
        : 0;
      if (isElectiveA !== isElectiveB) {
        return isElectiveA - isElectiveB;
      }
      const creditsA = (nodeA.data?.credits as number) || 0;
      const creditsB = (nodeB.data?.credits as number) || 0;
      if (creditsB !== creditsA) return creditsB - creditsA;
      return a.localeCompare(b);
    });
  });

  // Step 2: 4-pass Barycenter ordering (forward, backward, forward, backward)
  for (let pass = 0; pass < 4; pass++) {
    const isForward = pass % 2 === 0;

    if (isForward) {
      // Forward pass: columns 1 to totalColumns - 1
      for (let c = 1; c < totalColumns; c++) {
        const prevColOrder = new Map(
          columns[c - 1].map((id, idx) => [id, idx]),
        );

        columns[c].sort((a, b) => {
          const inA = (reverseAdjacency.get(a) || []).filter((id) =>
            prevColOrder.has(id),
          );
          const inB = (reverseAdjacency.get(b) || []).filter((id) =>
            prevColOrder.has(id),
          );

          const baryA =
            inA.length > 0
              ? inA.reduce((sum, id) => sum + prevColOrder.get(id)!, 0) /
                inA.length
              : -1;
          const baryB =
            inB.length > 0
              ? inB.reduce((sum, id) => sum + prevColOrder.get(id)!, 0) /
                inB.length
              : -1;

          if (baryA !== -1 && baryB !== -1) {
            if (baryA !== baryB) return baryA - baryB;
          } else if (baryA !== -1) {
            return -1;
          } else if (baryB !== -1) {
            return 1;
          }
          return 0; // maintain stability
        });
      }
    } else {
      // Backward pass: columns totalColumns - 2 down to 0
      for (let c = totalColumns - 2; c >= 0; c--) {
        const nextColOrder = new Map(
          columns[c + 1].map((id, idx) => [id, idx]),
        );

        columns[c].sort((a, b) => {
          const outA = (adjacency.get(a) || []).filter((id) =>
            nextColOrder.has(id),
          );
          const outB = (adjacency.get(b) || []).filter((id) =>
            nextColOrder.has(id),
          );

          const baryA =
            outA.length > 0
              ? outA.reduce((sum, id) => sum + nextColOrder.get(id)!, 0) /
                outA.length
              : -1;
          const baryB =
            outB.length > 0
              ? outB.reduce((sum, id) => sum + nextColOrder.get(id)!, 0) /
                outB.length
              : -1;

          if (baryA !== -1 && baryB !== -1) {
            if (baryA !== baryB) return baryA - baryB;
          } else if (baryA !== -1) {
            return -1;
          } else if (baryB !== -1) {
            return 1;
          }
          return 0; // maintain stability
        });
      }
    }
  }

  // Step 3: Compute Cartesian Coordinates (RTL: Column 0 at the rightmost position)
  const layoutedNodes: Node[] = [];
  const columnHeaders: LayoutResult["columnHeaders"] = [];

  for (let c = 0; c < totalColumns; c++) {
    // In RTL, column 0 is furthest to the right
    const colX = (maxCol - c) * (NODE_WIDTH + HORIZONTAL_GAP);

    let totalCreditsInCol = 0;

    columns[c].forEach((nodeId, rowIdx) => {
      const originalNode = nodeMap.get(nodeId)!;
      const posY = HEADER_OFFSET_Y + rowIdx * (NODE_HEIGHT + VERTICAL_GAP);
      const credits = (originalNode.data?.credits as number) || 0;
      totalCreditsInCol += credits;

      layoutedNodes.push({
        ...originalNode,
        targetPosition: Position.Right, // receives edges from earlier columns on right
        sourcePosition: Position.Left, // outputs edges to later columns on left
        position: { x: colX, y: posY },
        draggable: false,
        data: {
          ...originalNode.data,
          column: c,
        },
      });
    });

    const title =
      c < SEMESTER_LABELS.length ? SEMESTER_LABELS[c] : `المستوى ${c + 1}`;

    columnHeaders.push({
      column: c,
      title,
      totalCredits: totalCreditsInCol,
      courseCount: columns[c].length,
      x: colX,
      y: 0,
      width: NODE_WIDTH,
    });
  }

  // Format edges with orthogonal smoothstep and 6px border radius
  const layoutedEdges: Edge[] = edges.map((e) => ({
    ...e,
    type: "smoothstep",
    animated: false,
    pathOptions: {
      borderRadius: 6,
      offset: 12,
    },
    style: {
      stroke: "var(--line)",
      strokeWidth: 1,
    },
  }));

  const layoutResult: LayoutResult = {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    totalColumns,
    columnHeaders,
  };

  if (layoutCache.size > 20) layoutCache.clear();
  layoutCache.set(cacheKey, layoutResult);

  return layoutResult;
}
