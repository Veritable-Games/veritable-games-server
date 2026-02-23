/**
 * Shared TypeScript interfaces for Godot MCP Server
 */

export interface GraphNode {
  id: string;
  label: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  metadata?: {
    functionCount?: number;
    signalCount?: number;
    exportCount?: number;
  };
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'extends' | 'preload' | 'load';
  weight: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    isolatedNodes: number;
    averageDegree: number;
  };
}

export interface ScriptAnalysis {
  filePath: string;
  className?: string;
  extendsClass?: string;
  dependencies: Array<{
    type: 'extends' | 'preload' | 'load';
    path: string;
    line: number;
  }>;
  signals: Array<{
    name: string;
    params?: string[];
    line: number;
  }>;
  functions: Array<{
    name: string;
    params: string[];
    line: number;
    calls: string[];
  }>;
  exports: Array<{
    name: string;
    type?: string;
    line: number;
  }>;
}

export interface RuntimeEvent {
  type: 'function_call' | 'signal_emit' | 'script_load';
  scriptPath: string;
  functionName?: string;
  timestamp: number;
}

export interface BuildStatus {
  versionId: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  buildPath?: string;
  error?: string;
  lastBuildAt?: string;
}

export interface Version {
  id: number;
  version_tag: string;
  is_active: boolean;
  build_status: string;
  created_at: string;
}

export interface Project {
  id: number;
  project_slug: string;
  title: string;
  description?: string;
  version_count: number;
}
