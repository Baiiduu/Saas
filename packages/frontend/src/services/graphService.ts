import { del, get, patch, post, put } from './api';

export type GraphNodeType = 'task' | 'document' | 'member' | 'milestone' | 'git_repo';

export type GraphRelationType =
  | 'depends_on'
  | 'produces'
  | 'owned_by'
  | 'belongs_to'
  | 'references'
  | 'backed_by_repo';

export interface GraphNodeBackend {
  id: string;
  type: GraphNodeType | string;
  nodeType?: GraphNodeType;
  resourceType?: string | null;
  resourceId?: string | null;
  label: string;
  title?: string;
  description?: string | null;
  parentNodeId?: string | null;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
  size?: { width?: number | null; height?: number | null };
}

export interface GraphEdgeBackend {
  id: string;
  source: string;
  target: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  label?: string;
  relationType?: GraphRelationType;
  type?: string;
  data?: Record<string, unknown>;
}

export interface GraphResponse {
  nodes: GraphNodeBackend[];
  edges: GraphEdgeBackend[];
}

export interface TeamGraphCanvasResponse extends GraphResponse {
  canvas: {
    id: string;
    name: string;
    description?: string | null;
    teamId: string;
    tenantId: string;
    viewport?: Record<string, unknown> | null;
    canEdit: boolean;
  };
  relationTypes: Array<{ value: GraphRelationType; label: string }>;
}

export interface ResourcePoolItem {
  id: string;
  type: GraphNodeType;
  label: string;
  meta?: Record<string, unknown>;
}

export interface GraphResourcePool {
  tasks: ResourcePoolItem[];
  documents: ResourcePoolItem[];
  members: ResourcePoolItem[];
  milestones: ResourcePoolItem[];
}

export interface CreateGraphNodePayload {
  nodeType: GraphNodeType;
  resourceId?: string;
  title?: string;
  description?: string;
  url?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  parentNodeId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateGraphNodePayload {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  parentNodeId?: string | null;
  title?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateGraphEdgePayload {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: GraphRelationType;
}

export interface UpdateGraphEdgePayload {
  relationType?: GraphRelationType;
}

export function getGraph(
  resourceType: string,
  resourceId: string,
  typeFilter?: string,
): Promise<GraphResponse> {
  const params: Record<string, string> = {};
  if (typeFilter) {
    params.typeFilter = typeFilter;
  }
  return get<GraphResponse>(`/graph/${resourceType}/${resourceId}`, { params });
}

export function getTeamCanvas(teamId: string): Promise<TeamGraphCanvasResponse> {
  return get<TeamGraphCanvasResponse>(`/graph/teams/${teamId}/canvas`);
}

export function saveTeamCanvas(
  teamId: string,
  payload: {
    nodes?: Array<CreateGraphNodePayload & { id?: string }>;
    edges?: Array<CreateGraphEdgePayload & { id?: string }>;
    viewport?: Record<string, unknown>;
  },
): Promise<TeamGraphCanvasResponse> {
  return put<TeamGraphCanvasResponse>(`/graph/teams/${teamId}/canvas`, payload);
}

export function getGraphResourcePool(teamId: string): Promise<GraphResourcePool> {
  return get<GraphResourcePool>(`/graph/teams/${teamId}/resources`);
}

export function createGraphNode(
  teamId: string,
  payload: CreateGraphNodePayload,
): Promise<GraphNodeBackend> {
  return post<GraphNodeBackend>(`/graph/teams/${teamId}/nodes`, payload);
}

export function updateGraphNode(
  nodeId: string,
  payload: UpdateGraphNodePayload,
): Promise<GraphNodeBackend> {
  return patch<GraphNodeBackend>(`/graph/nodes/${nodeId}`, payload);
}

export function deleteGraphNode(nodeId: string): Promise<void> {
  return del<void>(`/graph/nodes/${nodeId}`);
}

export function createGraphEdge(
  teamId: string,
  payload: CreateGraphEdgePayload,
): Promise<GraphEdgeBackend> {
  return post<GraphEdgeBackend>(`/graph/teams/${teamId}/edges`, payload);
}

export function updateGraphEdge(
  edgeId: string,
  payload: UpdateGraphEdgePayload,
): Promise<GraphEdgeBackend> {
  return patch<GraphEdgeBackend>(`/graph/edges/${edgeId}`, payload);
}

export function deleteGraphEdge(edgeId: string): Promise<void> {
  return del<void>(`/graph/edges/${edgeId}`);
}
