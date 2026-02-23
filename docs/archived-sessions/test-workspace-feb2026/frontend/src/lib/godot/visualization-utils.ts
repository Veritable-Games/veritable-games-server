import * as THREE from 'three';

/**
 * Create a canvas-based text sprite for 3D visualization
 * Useful for labeling nodes and edges in Three.js scenes
 */
export function createTextSprite(
  text: string,
  options: {
    fontSize?: number;
    fontFace?: string;
    textColor?: string;
    backgroundColor?: string;
    padding?: number;
  } = {}
): THREE.Sprite {
  const {
    fontSize = 24,
    fontFace = 'Arial',
    textColor = '#ffffff',
    backgroundColor = 'rgba(0,0,0,0.7)',
    padding = 8,
  } = options;

  // Create canvas for text rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get 2D context from canvas');
  }

  // Set font and measure text
  context.font = `bold ${fontSize}px ${fontFace}`;
  const metrics = context.measureText(text);
  const textWidth = metrics.width;

  // Calculate canvas size (power of 2 for WebGL efficiency)
  const width = Math.pow(2, Math.ceil(Math.log2(textWidth + padding * 2)));
  const height = Math.pow(2, Math.ceil(Math.log2(fontSize + padding * 2)));

  canvas.width = width;
  canvas.height = height;

  // Re-set font after canvas resize
  context.font = `bold ${fontSize}px ${fontFace}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  // Draw background
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.fillStyle = textColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create sprite material and sprite object
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);

  // Scale sprite based on text aspect ratio
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(aspect * 0.5, 0.5, 1.0);

  return sprite;
}

/**
 * Create an arrowed line connecting two points in 3D space
 * Shows directionality for dependency connections
 */
export function createArrowedLine(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  edgeType: 'extends' | 'preload' | 'load'
): THREE.Group {
  const group = new THREE.Group();

  // Main line between nodes
  const points = [from.clone(), to.clone()];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const lineMaterial = new THREE.LineBasicMaterial({
    color,
    opacity: edgeType === 'extends' ? 0.8 : 0.5,
    transparent: true,
    linewidth: edgeType === 'extends' ? 2 : 1,
  });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  group.add(line);

  // Arrow cone at 75% along the line
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const arrowPos = from.clone().add(direction.clone().multiplyScalar(0.75));

  const arrowGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
  const arrowMaterial = new THREE.MeshBasicMaterial({ color });
  const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

  // Orient arrow toward 'to' node
  arrow.position.copy(arrowPos);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());

  group.add(arrow);
  group.userData = { edgeType, from, to };

  return group;
}
