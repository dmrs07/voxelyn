/**
 * Camera system for infinite world scrolling
 * Handles coordinate conversion between screen, world, and grid spaces
 * Supports smooth following with dead zones
 */

// ============================================================================
// TYPES
// ============================================================================

export type Camera = {
  /** Current camera X position (world coordinates) */
  x: number;
  /** Current camera Y position (world coordinates) */
  y: number;
  /** Target X for smooth following */
  targetX: number;
  /** Target Y for smooth following */
  targetY: number;
  /** World origin X - tracks grid shifts for floating origin */
  worldOriginX: number;
  /** World origin Y - tracks grid shifts for floating origin */
  worldOriginY: number;
  /** Screen/viewport width */
  viewWidth: number;
  /** Screen/viewport height */
  viewHeight: number;
  /** Dead zone - camera won't move if player within this radius of center */
  deadZone: number;
  /** Smoothing factor (0-1, lower = smoother/slower) */
  smoothing: number;
};

export type CameraConfig = {
  viewWidth: number;
  viewHeight: number;
  deadZone?: number;
  smoothing?: number;
};

// ============================================================================
// CAMERA FACTORY
// ============================================================================

export function createCamera(config: CameraConfig): Camera {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    worldOriginX: 0,
    worldOriginY: 0,
    viewWidth: config.viewWidth,
    viewHeight: config.viewHeight,
    deadZone: config.deadZone ?? 8,
    smoothing: config.smoothing ?? 0.15,
  };
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/**
 * Convert screen coordinates to world coordinates
 * Screen (0,0) = top-left of viewport
 * World coordinates = absolute position in infinite world
 */
export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number
): { worldX: number; worldY: number } {
  return {
    worldX: screenX + camera.x,
    worldY: screenY + camera.y,
  };
}

/**
 * Convert world coordinates to screen coordinates
 * Returns position relative to viewport
 */
export function worldToScreen(
  camera: Camera,
  worldX: number,
  worldY: number
): { screenX: number; screenY: number } {
  return {
    screenX: worldX - camera.x,
    screenY: worldY - camera.y,
  };
}

/**
 * Convert world coordinates to grid coordinates
 * Grid coordinates are relative to the current grid origin
 */
export function worldToGrid(
  camera: Camera,
  worldX: number,
  worldY: number
): { gridX: number; gridY: number } {
  return {
    gridX: worldX - camera.worldOriginX,
    gridY: worldY - camera.worldOriginY,
  };
}

/**
 * Convert grid coordinates to world coordinates
 */
export function gridToWorld(
  camera: Camera,
  gridX: number,
  gridY: number
): { worldX: number; worldY: number } {
  return {
    worldX: gridX + camera.worldOriginX,
    worldY: gridY + camera.worldOriginY,
  };
}

/**
 * Convert screen coordinates directly to grid coordinates
 */
export function screenToGrid(
  camera: Camera,
  screenX: number,
  screenY: number
): { gridX: number; gridY: number } {
  const { worldX, worldY } = screenToWorld(camera, screenX, screenY);
  return worldToGrid(camera, worldX, worldY);
}

/**
 * Convert grid coordinates directly to screen coordinates
 */
export function gridToScreen(
  camera: Camera,
  gridX: number,
  gridY: number
): { screenX: number; screenY: number } {
  const { worldX, worldY } = gridToWorld(camera, gridX, gridY);
  return worldToScreen(camera, worldX, worldY);
}

// ============================================================================
// CAMERA UPDATE
// ============================================================================

/**
 * Update camera to follow a target position (usually player)
 * Uses smooth interpolation with dead zone
 */
export function updateCamera(
  camera: Camera,
  targetWorldX: number,
  targetWorldY: number
): void {
  // Calculate desired camera center position
  // Camera position is top-left of viewport, so offset by half view size
  const desiredX = targetWorldX - camera.viewWidth * 0.5;
  const desiredY = targetWorldY - camera.viewHeight * 0.5;

  // Calculate distance from current target to desired position
  const dx = desiredX - camera.targetX;
  const dy = desiredY - camera.targetY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Only update target if outside dead zone
  if (distance > camera.deadZone) {
    // Move target toward desired, respecting dead zone
    const moveDistance = distance - camera.deadZone;
    const ratio = moveDistance / distance;
    camera.targetX += dx * ratio;
    camera.targetY += dy * ratio;
  }

  // Smooth interpolation toward target
  camera.x += (camera.targetX - camera.x) * camera.smoothing;
  camera.y += (camera.targetY - camera.y) * camera.smoothing;
}

/**
 * Instantly snap camera to target position (no smoothing)
 * Useful for teleportation or initial positioning
 */
export function snapCamera(
  camera: Camera,
  targetWorldX: number,
  targetWorldY: number
): void {
  camera.x = targetWorldX - camera.viewWidth * 0.5;
  camera.y = targetWorldY - camera.viewHeight * 0.5;
  camera.targetX = camera.x;
  camera.targetY = camera.y;
}

// ============================================================================
// GRID SHIFT DETECTION
// ============================================================================

/**
 * Check if grid needs to be shifted to keep player centered
 * Returns shift amount in chunks if shift needed, null otherwise
 */
export function checkGridShift(
  camera: Camera,
  playerGridX: number,
  playerGridY: number,
  gridWidth: number,
  gridHeight: number,
  chunkSize: number
): { shiftX: number; shiftY: number } | null {
  // Calculate grid center
  const gridCenterX = gridWidth * 0.5;
  const gridCenterY = gridHeight * 0.5;

  // Calculate player distance from center in chunks
  const playerChunkX = Math.floor(playerGridX / chunkSize);
  const playerChunkY = Math.floor(playerGridY / chunkSize);
  const centerChunkX = Math.floor(gridCenterX / chunkSize);
  const centerChunkY = Math.floor(gridCenterY / chunkSize);

  const chunkDistX = playerChunkX - centerChunkX;
  const chunkDistY = playerChunkY - centerChunkY;

  // Trigger shift if player is more than 1 chunk from center
  let shiftX = 0;
  let shiftY = 0;

  if (Math.abs(chunkDistX) > 1) {
    shiftX = chunkDistX > 0 ? 1 : -1;
  }
  if (Math.abs(chunkDistY) > 1) {
    shiftY = chunkDistY > 0 ? 1 : -1;
  }

  if (shiftX !== 0 || shiftY !== 0) {
    return { shiftX, shiftY };
  }

  return null;
}

/**
 * Apply grid shift to camera origin
 * Called after grid data has been shifted
 */
export function applyGridShift(
  camera: Camera,
  shiftX: number,
  shiftY: number,
  chunkSize: number
): void {
  camera.worldOriginX += shiftX * chunkSize;
  camera.worldOriginY += shiftY * chunkSize;
}

// ============================================================================
// VISIBILITY HELPERS
// ============================================================================

/**
 * Check if a world position is visible on screen (with optional margin)
 */
export function isWorldPosVisible(
  camera: Camera,
  worldX: number,
  worldY: number,
  margin: number = 0
): boolean {
  const { screenX, screenY } = worldToScreen(camera, worldX, worldY);
  return (
    screenX >= -margin &&
    screenX < camera.viewWidth + margin &&
    screenY >= -margin &&
    screenY < camera.viewHeight + margin
  );
}

/**
 * Check if a grid position is visible on screen
 */
export function isGridPosVisible(
  camera: Camera,
  gridX: number,
  gridY: number,
  margin: number = 0
): boolean {
  const { worldX, worldY } = gridToWorld(camera, gridX, gridY);
  return isWorldPosVisible(camera, worldX, worldY, margin);
}

/**
 * Get the visible grid bounds (for optimized rendering)
 */
export function getVisibleGridBounds(
  camera: Camera,
  gridWidth: number,
  gridHeight: number,
  margin: number = 0
): { minX: number; maxX: number; minY: number; maxY: number } {
  // Convert screen corners to grid coordinates
  const topLeft = screenToGrid(camera, -margin, -margin);
  const bottomRight = screenToGrid(
    camera,
    camera.viewWidth + margin,
    camera.viewHeight + margin
  );

  return {
    minX: Math.max(0, Math.floor(topLeft.gridX)),
    maxX: Math.min(gridWidth - 1, Math.ceil(bottomRight.gridX)),
    minY: Math.max(0, Math.floor(topLeft.gridY)),
    maxY: Math.min(gridHeight - 1, Math.ceil(bottomRight.gridY)),
  };
}
