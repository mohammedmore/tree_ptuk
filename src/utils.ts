import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'RL') => {
  // Always create a new graph instance on each call to prevent accumulation of nodes/edges
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure layout configuration logic with wider visual separation to avoid overlapping
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 120, // Space between nodes in the same rank (Y-axis separation) - زيادة من 80
    ranksep: 150, // Space between ranks/semesters (X-axis separation) - زيادة من 120
    marginx: 50,  // زيادة من 40
    marginy: 50,  // زيادة من 40
  });

  const nodeWidth = 256;  // تحديث ليعكس البطاقة الجديدة (w-64 = 256px تقريبا)
  const nodeHeight = 280; // زيادة للارتفاع المتغير

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: direction === 'LR' ? 'left' : direction === 'RL' ? 'right' : 'top',
      sourcePosition: direction === 'LR' ? 'right' : direction === 'RL' ? 'left' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes as Node[], edges };
};
