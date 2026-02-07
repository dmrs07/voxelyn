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
  /** Camera velocity X (for spring-damper physics) */
  velX: number;
  /** Camera velocity Y (for spring-damper physics) */
  velY: number;
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
  /** Spring stiffness (0-1, higher = snappier) */
  stiffness: number;
  /** Spring damping (0-1, higher = less oscillation) */
  damping: number;
  /** Zoom level (for future use) */
  zoom: number;
};

export type CameraConfig = {
  viewWidth: number;
  viewHeight: number;
  deadZone?: number;
  stiffness?: number;
  damping?: number;
  zoom?: number;
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
    velX: 0,
    velY: 0,
    worldOriginX: 0,
    worldOriginY: 0,
    viewWidth: config.viewWidth,
    viewHeight: config.viewHeight,
    deadZone: config.deadZone ?? 4,
    stiffness: config.stiffness ?? 0.08,
    damping: config.damping ?? 0.75,
    zoom: config.zoom ?? 1,
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

/** Snap threshold - if camera is closer than this to target, snap instantly */
const CAMERA_SNAP_THRESHOLD = 0.5;
/** Minimum velocity to prevent jitter */
const CAMERA_MIN_VELOCITY = 0.01;

/**
 * Update camera to follow a target position using spring-damper physics
 * Creates smooth ease-in and ease-out motion without overshoot
 */
export function updateCamera(
  camera: Camera,
  targetWorldX: number,
  targetWorldY: number
): void {
  // Calculate desired camera center position
  const desiredX = targetWorldX - camera.viewWidth * 0.5;
  const desiredY = targetWorldY - camera.viewHeight * 0.5;

  // Calculate distance from current to desired position
  const dx = desiredX - camera.x;
  const dy = desiredY - camera.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Apply dead zone - only move if outside threshold
  if (distance <= camera.deadZone) {
    // Inside dead zone - gradually slow down
    camera.velX *= camera.damping * 0.5;
    camera.velY *= camera.damping * 0.5;
  } else {
    // Spring-damper physics:
    // velocity = velocity * damping + (target - position) * stiffness
    const effectiveDx = dx - (dx / distance) * camera.deadZone;
    const effectiveDy = dy - (dy / distance) * camera.deadZone;
    
    camera.velX = camera.velX * camera.damping + effectiveDx * camera.stiffness;
    camera.velY = camera.velY * camera.damping + effectiveDy * camera.stiffness;
  }
  
  // Snap velocity to zero if very small to prevent perpetual micro-movements
  if (Math.abs(camera.velX) < CAMERA_MIN_VELOCITY) camera.velX = 0;
  if (Math.abs(camera.velY) < CAMERA_MIN_VELOCITY) camera.velY = 0;
  
  // Apply velocity
  camera.x += camera.velX;
  camera.y += camera.velY;
  
  // Prevent overshoot - if we crossed the target, clamp
  const newDx = desiredX - camera.x;
  const newDy = desiredY - camera.y;
  
  // Check if we crossed the target (sign change) or are very close
  if (Math.abs(newDx) < CAMERA_SNAP_THRESHOLD || (dx * newDx < 0)) {
    camera.x = desiredX;
    camera.velX = 0;
  }
  if (Math.abs(newDy) < CAMERA_SNAP_THRESHOLD || (dy * newDy < 0)) {
    camera.y = desiredY;
    camera.velY = 0;
  }
}

/**
 * Get rounded camera position for pixel-perfect rendering
 * Use this when drawing to avoid sub-pixel artifacts
 */
export function getCameraRenderPos(camera: Camera): { x: number; y: number } {
  return {
    x: Math.round(camera.x),
    y: Math.round(camera.y)
  };
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
