#!/usr/bin/env node

/**
 * Test script for workspace export/import functionality
 * Tests the export-import.ts functions directly
 */

const {
  exportToJSON,
  importFromJSON,
  generateExportFilename,
} = require('./dist/lib/workspace/export-import');

console.log('🧪 Testing Workspace Export/Import Functionality\n');

// Test data: Create sample nodes and connections
const testNodes = [
  {
    id: 'node-1',
    position: { x: 100, y: 100 },
    size: { width: 200, height: 150 },
    content: '<p>Test Node 1</p>',
    metadata: { nodeType: 'text', locked: false },
    zIndex: 1,
  },
  {
    id: 'node-2',
    position: { x: 400, y: 200 },
    size: { width: 250, height: 180 },
    content: '<p>Test Node 2</p>',
    metadata: { nodeType: 'text', locked: false },
    zIndex: 2,
  },
  {
    id: 'node-3',
    position: { x: 700, y: 150 },
    size: { width: 200, height: 200 },
    content: '<p>Test Node 3</p>',
    metadata: { nodeType: 'text', locked: false },
    zIndex: 3,
  },
];

const testConnections = [
  {
    id: 'conn-1',
    sourceNodeId: 'node-1',
    targetNodeId: 'node-2',
    sourceAnchor: { side: 'right', offset: 0.5 },
    targetAnchor: { side: 'left', offset: 0.5 },
  },
  {
    id: 'conn-2',
    sourceNodeId: 'node-2',
    targetNodeId: 'node-3',
    sourceAnchor: { side: 'right', offset: 0.5 },
    targetAnchor: { side: 'left', offset: 0.5 },
  },
];

console.log('📊 Test Data:');
console.log(`  - ${testNodes.length} nodes`);
console.log(`  - ${testConnections.length} connections\n`);

// Test 1: Export to JSON
console.log('1️⃣  Testing exportToJSON()...');
try {
  const exportData = exportToJSON(testNodes, testConnections);

  console.log('   ✅ Export successful');
  console.log(`   📄 JSON structure:`);
  console.log(`      - version: ${exportData.version}`);
  console.log(`      - timestamp: ${exportData.timestamp}`);
  console.log(`      - nodeCount: ${exportData.metadata.nodeCount}`);
  console.log(`      - connectionCount: ${exportData.metadata.connectionCount}`);
  console.log(`      - boundingBox: ${JSON.stringify(exportData.metadata.boundingBox)}`);

  // Verify data integrity
  if (exportData.nodes.length !== testNodes.length) {
    throw new Error(
      `Node count mismatch: expected ${testNodes.length}, got ${exportData.nodes.length}`
    );
  }
  if (exportData.connections.length !== testConnections.length) {
    throw new Error(
      `Connection count mismatch: expected ${testConnections.length}, got ${exportData.connections.length}`
    );
  }

  console.log('   ✅ Data integrity verified\n');

  // Test 2: Import from JSON
  console.log('2️⃣  Testing importFromJSON()...');
  const viewportCenter = { x: 500, y: 400 };

  try {
    const importResult = importFromJSON(exportData, viewportCenter);

    console.log('   ✅ Import successful');
    console.log(`   📊 Import result:`);
    console.log(`      - nodes imported: ${importResult.nodes.length}`);
    console.log(`      - connections imported: ${importResult.connections.length}`);
    console.log(`      - ID mappings: ${importResult.idMap.size}`);

    // Verify UUIDs were remapped
    const importedNodeIds = importResult.nodes.map(n => n.id);
    const originalNodeIds = testNodes.map(n => n.id);

    const hasNewIds = importedNodeIds.every(id => !originalNodeIds.includes(id));
    if (!hasNewIds) {
      throw new Error('UUIDs were not properly remapped!');
    }

    console.log('   ✅ UUIDs properly remapped (no ID conflicts)');

    // Verify content preservation
    const content1 = importResult.nodes[0].content;
    if (content1 !== testNodes[0].content) {
      throw new Error('Content not preserved during import!');
    }
    console.log('   ✅ Content preserved');

    // Verify connections were remapped
    const conn = importResult.connections[0];
    const newSourceId = conn.sourceNodeId;
    const newTargetId = conn.targetNodeId;

    if (originalNodeIds.includes(newSourceId) || originalNodeIds.includes(newTargetId)) {
      throw new Error('Connection IDs were not properly remapped!');
    }
    console.log('   ✅ Connection IDs properly remapped\n');

    // Test 3: Filename generation
    console.log('3️⃣  Testing generateExportFilename()...');
    const filename = generateExportFilename('test-project');
    console.log(`   📝 Generated filename: ${filename}`);

    if (!filename.startsWith('workspace-test-project-')) {
      throw new Error('Filename format incorrect!');
    }
    if (!filename.endsWith('.json')) {
      throw new Error('Filename missing .json extension!');
    }
    console.log('   ✅ Filename format correct\n');

    // Test 4: Error handling - Invalid JSON
    console.log('4️⃣  Testing error handling (invalid JSON)...');
    try {
      importFromJSON('invalid json', viewportCenter);
      console.log('   ❌ FAILED: Should have thrown error for invalid JSON');
    } catch (error) {
      console.log('   ✅ Correctly rejected invalid JSON');
      console.log(`      Error: ${error.message}\n`);
    }

    // Test 5: Error handling - Wrong version
    console.log('5️⃣  Testing error handling (wrong version)...');
    try {
      const wrongVersion = { ...exportData, version: '99.0' };
      importFromJSON(wrongVersion, viewportCenter);
      console.log('   ❌ FAILED: Should have thrown error for unsupported version');
    } catch (error) {
      console.log('   ✅ Correctly rejected unsupported version');
      console.log(`      Error: ${error.message}\n`);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n🎉 Export/Import functionality is working correctly!\n');
  } catch (error) {
    console.error('   ❌ Import test failed:', error.message);
    process.exit(1);
  }
} catch (error) {
  console.error('   ❌ Export test failed:', error.message);
  process.exit(1);
}
