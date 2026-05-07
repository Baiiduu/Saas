import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import GraphNode from './GraphNode';
import type { GraphNodeData } from './GraphNode';

const nodeTypes = {
  graphNode: GraphNode,
};

export interface ResourceGraphItem {
  id: string;
  label: string;
  type: 'resource' | 'task' | 'member' | 'milestone';
  status?: string;
  description?: string;
}

export interface ResourceGraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ResourceGraphProps {
  nodes: ResourceGraphItem[];
  edges: ResourceGraphEdge[];
  onNodeClick?: (nodeId: string) => void;
}

const ResourceGraph: React.FC<ResourceGraphProps> = ({
  nodes: items,
  edges: edgeData,
  onNodeClick,
}) => {
  const initialNodes: Node<GraphNodeData>[] = useMemo(
    () =>
      items.map((item, index) => ({
        id: item.id,
        type: 'graphNode',
        position: { x: 200 * (index % 4), y: 120 * Math.floor(index / 4) },
        data: {
          label: item.label,
          type: item.type,
          status: item.status,
          description: item.description,
        },
      })),
    [items]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      edgeData.map((e, index) => ({
        id: `e-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: '#888' },
        markerEnd: { type: MarkerType.ArrowClosed },
        labelStyle: { fontSize: 11 },
      })),
    [edgeData]
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, , onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      // Connections are read-only in this visualization
      console.log('Connection attempted:', connection);
    },
    []
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: 500, border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#f5f5f5" gap={16} />
        <Controls />
        <MiniMap
          nodeStrokeColor="#888"
          nodeColor="#e6f7ff"
          nodeBorderRadius={4}
          style={{ border: '1px solid #f0f0f0' }}
        />
      </ReactFlow>
    </div>
  );
};

export default ResourceGraph;
