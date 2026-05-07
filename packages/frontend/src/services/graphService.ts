import { get } from './api';

export interface GraphNodeBackend {
  id: string;
  type: string;
  label: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface GraphEdgeBackend {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface GraphResponse {
  nodes: GraphNodeBackend[];
  edges: GraphEdgeBackend[];
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
