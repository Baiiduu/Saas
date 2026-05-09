import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
  type ReactFlowInstance,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import GraphNode from './GraphNode';
import type { GraphNodeData } from './GraphNode';
import type { GraphNodeType, GraphRelationType } from '@/services/graphService';

const nodeTypes = {
  graphNode: GraphNode,
};

export interface ResourceGraphItem {
  id: string;
  label: string;
  type: GraphNodeType | 'resource';
  status?: string;
  description?: string;
  parentNodeId?: string | null;
  parentLabel?: string;
  position?: { x: number; y: number };
  size?: { width?: number | null; height?: number | null };
  data?: Record<string, unknown>;
}

export interface ResourceGraphEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
  relationType?: GraphRelationType;
}

export interface ResourceDropData {
  type: GraphNodeType;
  resourceId?: string;
  label?: string;
}

export interface ResourceGraphProps {
  nodes: ResourceGraphItem[];
  edges: ResourceGraphEdge[];
  canEdit?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeResize?: (nodeId: string, size: { width: number; height: number }) => void;
  onConnectNodes?: (sourceNodeId: string, targetNodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onDropResource?: (resource: ResourceDropData, position: { x: number; y: number }) => void;
}

const ResourceGraph: React.FC<ResourceGraphProps> = ({
  nodes: items,
  edges: edgeData,
  canEdit = false,
  onNodeClick,
  onNodeDoubleClick,
  onNodeMove,
  onNodeResize,
  onConnectNodes,
  onEdgeClick,
  onEdgeDelete,
  onNodeDelete,
  onDropResource,
}) => {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const resizingNodeIdsRef = useRef(new Set<string>());

  const initialNodes: Node<GraphNodeData>[] = useMemo(
    () =>
      items.map((item, index) => ({
        id: item.id,
        type: 'graphNode',
        position: item.position ?? {
          x: 220 * (index % 4),
          y: 140 * Math.floor(index / 4),
        },
        data: {
          label: item.label,
          type: item.type,
          status: item.status,
          description: item.description,
          parentLabel: item.parentLabel,
          canResize: canEdit,
          isParent: item.type === 'milestone',
        },
        parentNode: item.parentNodeId ?? undefined,
        extent: item.parentNodeId ? 'parent' : undefined,
        expandParent: Boolean(item.parentNodeId),
        draggable: canEdit,
        connectable: canEdit,
        dragHandle: '.graph-node-drag-handle',
        style:
          item.type === 'milestone'
            ? {
                width: item.size?.width ?? 360,
                height: item.size?.height ?? 240,
                zIndex: -1,
              }
            : {
                width: item.size?.width ?? 190,
                height: item.size?.height ?? 96,
              },
      })),
    [canEdit, items],
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      edgeData.map((edge) => ({
        id: edge.id ?? `e-${edge.source}-${edge.target}-${edge.relationType ?? edge.label ?? 'edge'}`,
        source: edge.source,
        target: edge.target,
        label: edge.label ?? edge.relationType,
        animated: false,
        style: { stroke: '#64748b', strokeWidth: 1.6 },
        markerEnd: { type: MarkerType.ArrowClosed },
        labelStyle: { fontSize: 11, fontWeight: 600 },
      })),
    [edgeData],
  );

  const [flowNodes, setFlowNodes, baseOnNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);
  const lastResizeSaveRef = useRef(new Map<string, string>());

  useEffect(() => {
    setFlowNodes(initialNodes);
  }, [initialNodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(initialEdges);
  }, [initialEdges, setFlowEdges]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return;
      onConnectNodes?.(connection.source, connection.target);
    },
    [canEdit, onConnectNodes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      baseOnNodesChange(changes);
      if (!canEdit) return;

      changes.forEach((change) => {
        if (change.type !== 'dimensions' || !change.dimensions) {
          return;
        }

        if (change.resizing) {
          resizingNodeIdsRef.current.add(change.id);
          return;
        }

        if (!resizingNodeIdsRef.current.has(change.id)) {
          return;
        }

        resizingNodeIdsRef.current.delete(change.id);
        const width = Math.round(change.dimensions.width);
        const height = Math.round(change.dimensions.height);
        const nextKey = `${width}x${height}`;
        if (lastResizeSaveRef.current.get(change.id) === nextKey) {
          return;
        }
        lastResizeSaveRef.current.set(change.id, nextKey);
        onNodeResize?.(change.id, {
          width,
          height,
        });
      });
    },
    [baseOnNodesChange, canEdit, onNodeResize],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick],
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick],
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!canEdit) return;
      onNodeMove?.(node.id, node.position);
    },
    [canEdit, onNodeMove],
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (!canEdit) return;
      deletedEdges.forEach((edge) => onEdgeDelete?.(edge.id));
    },
    [canEdit, onEdgeDelete],
  );

  const handleNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (!canEdit) return;
      deletedNodes.forEach((node) => onNodeDelete?.(node.id));
    },
    [canEdit, onNodeDelete],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!canEdit) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, [canEdit]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!canEdit || !flowInstance) return;
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/x-resource-graph-node');
      if (!raw) return;

      const resource = JSON.parse(raw) as ResourceDropData;
      const position = flowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      onDropResource?.(resource, position);
    },
    [canEdit, flowInstance, onDropResource],
  );

  return (
    <div style={{ width: '100%', height: 620, border: '1px solid #f0f0f0', borderRadius: 8 }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onNodesDelete={handleNodesDelete}
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeDragStop={handleNodeDragStop}
        onInit={setFlowInstance}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable
        deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={18} />
        <MiniMap
          nodeStrokeColor="#64748b"
          nodeColor="#eff6ff"
          nodeBorderRadius={6}
          style={{ border: '1px solid #f0f0f0' }}
        />
      </ReactFlow>
    </div>
  );
};

export default ResourceGraph;
