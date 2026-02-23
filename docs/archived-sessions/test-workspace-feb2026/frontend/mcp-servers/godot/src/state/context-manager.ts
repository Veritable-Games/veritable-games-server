import { RuntimeEvent, BuildStatus } from '../utils/types.js';

interface ServerState {
  currentVersionId?: number;
  defaultVersionId?: number; // Default version for instance mode (from env)
  selectedNodePath?: string;
  buildStatusCache: Map<number, BuildStatus>;
  runtimeEventBuffer: RuntimeEvent[];
  lastUpdated: Date;
}

class ContextManager {
  private state: ServerState = {
    buildStatusCache: new Map(),
    runtimeEventBuffer: [],
    lastUpdated: new Date(),
  };

  setSelectedNode(versionId: number, scriptPath: string): void {
    this.state.currentVersionId = versionId;
    this.state.selectedNodePath = scriptPath;
    this.state.lastUpdated = new Date();
    console.error(`[ContextManager] Context updated: version=${versionId}, node=${scriptPath}`);
  }

  getSelectedNode(): { versionId?: number; scriptPath?: string } {
    return {
      versionId: this.state.currentVersionId,
      scriptPath: this.state.selectedNodePath,
    };
  }

  updateBuildStatus(versionId: number, status: BuildStatus): void {
    this.state.buildStatusCache.set(versionId, status);
    this.state.lastUpdated = new Date();
  }

  getBuildStatus(versionId: number): BuildStatus | undefined {
    return this.state.buildStatusCache.get(versionId);
  }

  addRuntimeEvent(event: RuntimeEvent): void {
    this.state.runtimeEventBuffer.push(event);

    // Keep only last 50 events
    if (this.state.runtimeEventBuffer.length > 50) {
      this.state.runtimeEventBuffer.shift();
    }

    this.state.lastUpdated = new Date();
  }

  getRuntimeEvents(): RuntimeEvent[] {
    return [...this.state.runtimeEventBuffer];
  }

  getFullState(): ServerState {
    return {
      ...this.state,
      buildStatusCache: new Map(this.state.buildStatusCache),
      runtimeEventBuffer: [...this.state.runtimeEventBuffer],
    };
  }

  /**
   * Set default version for instance mode (Phase 4 - Multi-Instance)
   * Called when instance is spawned with VERSION_ID environment variable
   */
  setDefaultVersion(versionId: number): void {
    this.state.defaultVersionId = versionId;
    // Also set as current version initially
    this.state.currentVersionId = versionId;
    console.error(`[ContextManager] Default version set to ${versionId} (instance mode)`);
  }

  /**
   * Get default version for instance mode
   * Falls back to currentVersionId if not set
   */
  getDefaultVersion(): number | undefined {
    return this.state.defaultVersionId || this.state.currentVersionId;
  }
}

export const contextManager = new ContextManager();
