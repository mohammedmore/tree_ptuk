import assert from "node:assert/strict";
import { test } from "node:test";
import type { Edge, Node } from "@xyflow/react";
import { getLayoutedElements } from "../src/utils";

const createNodes = (): Node[] => [
  { id: "first", position: { x: 0, y: 0 }, data: {} },
  { id: "second", position: { x: 0, y: 0 }, data: {} },
];

test("lays out graph nodes without mutating inputs and preserves edges", () => {
  const nodes = createNodes();
  const edges: Edge[] = [
    { id: "first-second", source: "first", target: "second" },
  ];
  const originalNodes = structuredClone(nodes);
  const originalEdges = structuredClone(edges);

  const result = getLayoutedElements(nodes, edges, "LR");

  assert.deepEqual(nodes, originalNodes);
  assert.deepEqual(edges, originalEdges);
  assert.strictEqual(result.edges, edges);
  assert.notDeepEqual(result.nodes[0].position, result.nodes[1].position);
  assert.equal(result.nodes[0].sourcePosition, "right");
  assert.equal(result.nodes[1].targetPosition, "left");
});

test("rejects duplicate node ids and edges with missing endpoints", () => {
  const duplicateNodes = createNodes();
  duplicateNodes[1].id = duplicateNodes[0].id;
  assert.throws(
    () => getLayoutedElements(duplicateNodes, []),
    /duplicate node id/,
  );

  const nodes = createNodes();
  const missingEndpoint: Edge[] = [
    { id: "missing-edge", source: "missing", target: "second" },
  ];
  assert.throws(
    () => getLayoutedElements(nodes, missingEndpoint),
    /source or target node is missing/,
  );
});
