import dagre from 'dagre';
import { Position, type Node, type Edge } from '@xyflow/react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

type LayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';

interface LayoutedElements {
  nodes: Node[];
  edges: Edge[];
}

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'RL',
): LayoutedElements => {
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw new Error(`Cannot layout duplicate node id "${node.id}".`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Cannot layout edge "${edge.id}" because its source or target node is missing.`);
    }
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 120,
    ranksep: 150,
    marginx: 50,
    marginy: 50,
  });

  const nodeWidth = 256;
  const nodeHeight = 280;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const targetPosition = direction === 'LR'
    ? Position.Left
    : direction === 'RL'
      ? Position.Right
      : direction === 'TB'
        ? Position.Top
        : Position.Bottom;
  const sourcePosition = direction === 'LR'
    ? Position.Right
    : direction === 'RL'
      ? Position.Left
      : direction === 'TB'
        ? Position.Bottom
        : Position.Top;

  const newNodes = nodes.map((node): Node => {
    const { x, y } = dagreGraph.node(node.id) as { x: number; y: number };
    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: x - nodeWidth / 2,
        y: y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};
