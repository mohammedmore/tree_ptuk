import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, Edge } from "@xyflow/react";
import {
  computeGraphLayout,
  computeCriticalPath,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "../src/core/graphLayout";
import { courses } from "../src/data";

test("computeGraphLayout places nodes in RTL columns without overlap", () => {
  const nodes: Node[] = courses.map((c) => ({
    id: c.id,
    data: { label: c.name, credits: c.credits },
    position: { x: 0, y: 0 },
  }));

  const edges: Edge[] = [];
  courses.forEach((c) => {
    (c.prerequisites || []).forEach((prereqId) => {
      if (courses.some((course) => course.id === prereqId)) {
        edges.push({
          id: `${prereqId}->${c.id}`,
          source: prereqId,
          target: c.id,
        });
      }
    });
  });

  const result = computeGraphLayout({ nodes, edges });

  assert.ok(result.totalColumns > 0, "Must have columns");
  assert.equal(result.nodes.length, nodes.length, "Must layout all courses");

  // Check 1: No two nodes overlap in coordinates
  for (let i = 0; i < result.nodes.length; i++) {
    for (let j = i + 1; j < result.nodes.length; j++) {
      const nodeA = result.nodes[i];
      const nodeB = result.nodes[j];

      const overlapX =
        nodeA.position.x < nodeB.position.x + NODE_WIDTH &&
        nodeA.position.x + NODE_WIDTH > nodeB.position.x;
      const overlapY =
        nodeA.position.y < nodeB.position.y + NODE_HEIGHT &&
        nodeA.position.y + NODE_HEIGHT > nodeB.position.y;

      assert.ok(
        !(overlapX && overlapY),
        `Collision detected between ${nodeA.id} and ${nodeB.id} at (${nodeA.position.x}, ${nodeA.position.y})`,
      );
    }
  }

  // Check 2: Prerequisite column is always on the right (higher X) than dependent column
  edges.forEach((edge) => {
    const src = result.nodes.find((n) => n.id === edge.source)!;
    const tgt = result.nodes.find((n) => n.id === edge.target)!;
    assert.ok(
      src.position.x >= tgt.position.x,
      `Prerequisite ${src.id} (x=${src.position.x}) must precede dependent ${tgt.id} (x=${tgt.position.x}) in RTL flow`,
    );
  });
});

test("computeCriticalPath computes valid longest prerequisite chain to graduation capstone and multiple critical paths", () => {
  const result = computeCriticalPath(courses);
  assert.ok(
    result.courseIds.size >= 4,
    "Critical path must have at least 4 courses",
  );
  assert.ok(
    result.orderedCourseIds.length >= 4,
    "Primary ordered course IDs must have at least 4 courses",
  );
  assert.ok(result.paths.length >= 2, "Must discover multiple critical paths");
  assert.ok(
    result.courseIds.size >= result.orderedCourseIds.length,
    "Union of critical courses must include at least primary chain",
  );

  const lastCourseId =
    result.orderedCourseIds[result.orderedCourseIds.length - 1];
  const lastCourse = courses.find((c) => c.id === lastCourseId);
  assert.ok(
    lastCourse?.name.includes("مشروع تخرج") || lastCourse?.id === "12140524",
    `Terminal course ${lastCourse?.name} should be graduation project or capstone`,
  );

  for (let i = 0; i < result.orderedCourseIds.length - 1; i++) {
    const curId = result.orderedCourseIds[i];
    const nextId = result.orderedCourseIds[i + 1];
    const nextCourse = courses.find((c) => c.id === nextId)!;
    assert.ok(
      nextCourse.prerequisites.includes(curId),
      `Course ${curId} must be in prerequisites of ${nextId}`,
    );
  }
});
