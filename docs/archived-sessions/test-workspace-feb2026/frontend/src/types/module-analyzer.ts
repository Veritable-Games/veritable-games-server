/**
 * Module Dependency Analysis and Circular Dependency Detection
 *
 * Utilities for analyzing module dependencies and detecting circular
 * imports that could impact TypeScript compilation performance.
 */

export interface ModuleDependency {
  from: string;
  to: string;
  importType: 'default' | 'named' | 'namespace' | 'dynamic';
  isTypeOnly: boolean;
  line: number;
}

export interface CircularDependency {
  cycle: string[];
  length: number;
}

export interface ModuleAnalysisResult {
  totalModules: number;
  totalDependencies: number;
  circularDependencies: CircularDependency[];
  dependencyDepth: Record<string, number>;
  orphanModules: string[];
  heaviestModules: Array<{ module: string; dependencyCount: number }>;
}

export class ModuleDependencyAnalyzer {
  private dependencies = new Map<string, ModuleDependency[]>();
  private reverseMap = new Map<string, string[]>();

  constructor() {
    this.dependencies = new Map();
    this.reverseMap = new Map();
  }

  /**
   * Add a dependency relationship between two modules
   */
  addDependency(dependency: ModuleDependency): void {
    const { from, to } = dependency;

    if (!this.dependencies.has(from)) {
      this.dependencies.set(from, []);
    }

    this.dependencies.get(from)!.push(dependency);

    // Update reverse mapping
    if (!this.reverseMap.has(to)) {
      this.reverseMap.set(to, []);
    }

    this.reverseMap.get(to)!.push(from);
  }

  /**
   * Parse import statements from source code to extract dependencies
   */
  parseImports(modulePath: string, sourceCode: string): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      const lineNumber = i + 1;

      // Skip comments and empty lines
      if (!line || line.startsWith('//') || line.startsWith('/*')) {
        continue;
      }

      // Match import statements
      const importRegexes = [
        // import defaultExport from "module"
        /^import\s+(\w+)\s+from\s+['"](.*?)['"]/,
        // import { named } from "module"
        /^import\s*\{\s*[^}]*\s*\}\s*from\s+['"](.*?)['"]/,
        // import * as namespace from "module"
        /^import\s*\*\s*as\s*\w+\s*from\s+['"](.*?)['"]/,
        // import type { Type } from "module"
        /^import\s+type\s*\{\s*[^}]*\s*\}\s*from\s+['"](.*?)['"]/,
        // import type DefaultType from "module"
        /^import\s+type\s+\w+\s+from\s+['"](.*?)['"]/,
        // Dynamic imports: import("module")
        /import\s*\(\s*['"](.*?)['"]\s*\)/,
      ];

      for (const regex of importRegexes) {
        const match = line.match(regex);
        if (match) {
          const importPath = match[match.length - 1] ?? ''; // Last capture group is always the module path
          const isTypeOnly = line.includes('import type');
          const isDynamic = line.includes('import(');

          let importType: ModuleDependency['importType'] = 'named';
          if (isDynamic) {
            importType = 'dynamic';
          } else if (line.includes('* as ')) {
            importType = 'namespace';
          } else if (!line.includes('{')) {
            importType = 'default';
          }

          dependencies.push({
            from: modulePath,
            to: importPath,
            importType,
            isTypeOnly,
            line: lineNumber,
          });

          this.addDependency({
            from: modulePath,
            to: importPath,
            importType,
            isTypeOnly,
            line: lineNumber,
          });
          break;
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect circular dependencies using DFS
   */
  findCircularDependencies(): CircularDependency[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: CircularDependency[] = [];
    const pathStack: string[] = [];

    const dfs = (node: string): boolean => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = pathStack.indexOf(node);
        if (cycleStart >= 0) {
          const cycle = pathStack.slice(cycleStart).concat(node);
          cycles.push({
            cycle,
            length: cycle.length - 1, // Don't count the duplicate node
          });
        }
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      pathStack.push(node);

      const dependencies = this.dependencies.get(node) || [];
      for (const dep of dependencies) {
        if (dfs(dep.to)) {
          // Cycle found, but continue to find all cycles
        }
      }

      recursionStack.delete(node);
      pathStack.pop();
      return false;
    };

    // Check all modules for cycles
    for (const module of this.dependencies.keys()) {
      if (!visited.has(module)) {
        dfs(module);
      }
    }

    return cycles;
  }

  /**
   * Calculate the dependency depth of each module
   */
  calculateDependencyDepths(): Record<string, number> {
    const depths: Record<string, number> = {};
    const visited = new Set<string>();

    const calculateDepth = (node: string): number => {
      if (visited.has(node)) {
        return depths[node] || 0;
      }

      visited.add(node);
      const dependencies = this.dependencies.get(node) || [];

      if (dependencies.length === 0) {
        depths[node] = 0;
        return 0;
      }

      let maxDepth = 0;
      for (const dep of dependencies) {
        const depDepth = calculateDepth(dep.to);
        maxDepth = Math.max(maxDepth, depDepth + 1);
      }

      depths[node] = maxDepth;
      return maxDepth;
    };

    for (const module of this.dependencies.keys()) {
      calculateDepth(module);
    }

    return depths;
  }

  /**
   * Find orphan modules (modules with no dependencies and no dependents)
   */
  findOrphanModules(): string[] {
    const allModules = new Set([
      ...this.dependencies.keys(),
      ...Array.from(this.dependencies.values())
        .flat()
        .map(d => d.to),
    ]);

    const orphans: string[] = [];

    for (const module of allModules) {
      const hasDependencies =
        this.dependencies.has(module) && this.dependencies.get(module)!.length > 0;
      const hasDependents = this.reverseMap.has(module) && this.reverseMap.get(module)!.length > 0;

      if (!hasDependencies && !hasDependents) {
        orphans.push(module);
      }
    }

    return orphans;
  }

  /**
   * Find modules with the most dependencies (potential refactoring candidates)
   */
  findHeaviestModules(topN: number = 10): Array<{ module: string; dependencyCount: number }> {
    const moduleWeights: Array<{ module: string; dependencyCount: number }> = [];

    for (const [module, deps] of this.dependencies) {
      moduleWeights.push({
        module,
        dependencyCount: deps.length,
      });
    }

    return moduleWeights.sort((a, b) => b.dependencyCount - a.dependencyCount).slice(0, topN);
  }

  /**
   * Generate a comprehensive analysis report
   */
  analyze(): ModuleAnalysisResult {
    const circularDependencies = this.findCircularDependencies();
    const dependencyDepth = this.calculateDependencyDepths();
    const orphanModules = this.findOrphanModules();
    const heaviestModules = this.findHeaviestModules();

    const allModules = new Set([
      ...this.dependencies.keys(),
      ...Array.from(this.dependencies.values())
        .flat()
        .map(d => d.to),
    ]);

    const totalDependencies = Array.from(this.dependencies.values()).reduce(
      (sum, deps) => sum + deps.length,
      0
    );

    return {
      totalModules: allModules.size,
      totalDependencies,
      circularDependencies,
      dependencyDepth,
      orphanModules,
      heaviestModules,
    };
  }

  /**
   * Get suggestions for fixing circular dependencies
   */
  getSuggestions(analysis: ModuleAnalysisResult): string[] {
    const suggestions: string[] = [];

    if (analysis.circularDependencies.length > 0) {
      suggestions.push(
        '🔄 Circular Dependencies Found:',
        ...analysis.circularDependencies.map(cycle => `  - ${cycle.cycle.join(' → ')}`),
        '',
        '💡 Suggestions to fix circular dependencies:',
        '  1. Extract shared types to a separate types module',
        '  2. Use dependency injection or inversion of control',
        '  3. Merge modules that are tightly coupled',
        '  4. Use dynamic imports for optional dependencies',
        '  5. Create barrel exports to centralize imports',
        ''
      );
    }

    if (analysis.orphanModules.length > 0) {
      suggestions.push(
        '🏝️ Orphan Modules (consider removing):',
        ...analysis.orphanModules.map(module => `  - ${module}`),
        ''
      );
    }

    if (analysis.heaviestModules.length > 0) {
      suggestions.push(
        '📦 Modules with many dependencies (consider refactoring):',
        ...analysis.heaviestModules
          .filter(m => m.dependencyCount > 10)
          .map(m => `  - ${m.module} (${m.dependencyCount} dependencies)`),
        ''
      );
    }

    const deepModules = Object.entries(analysis.dependencyDepth)
      .filter(([, depth]) => depth > 5)
      .sort((a, b) => b[1] - a[1]);

    if (deepModules.length > 0) {
      suggestions.push(
        '🕳️ Modules with deep dependency chains (consider flattening):',
        ...deepModules.map(([module, depth]) => `  - ${module} (depth: ${depth})`),
        ''
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ No major dependency issues detected!');
    }

    return suggestions;
  }

  /**
   * Export analysis as JSON for external tools
   */
  exportAnalysis(): string {
    const analysis = this.analyze();
    const suggestions = this.getSuggestions(analysis);

    return JSON.stringify(
      {
        ...analysis,
        suggestions,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }
}

/**
 * Utility function to analyze a codebase directory structure
 */
export const analyzeCodebase = async (srcDirectory: string): Promise<ModuleAnalysisResult> => {
  const analyzer = new ModuleDependencyAnalyzer();

  // This would need to be implemented with file system access
  // For now, return a placeholder
  return {
    totalModules: 0,
    totalDependencies: 0,
    circularDependencies: [],
    dependencyDepth: {},
    orphanModules: [],
    heaviestModules: [],
  };
};
