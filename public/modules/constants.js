/**
 * Tunable game constants. Centralised here so agents and developers can
 * adjust game feel without hunting through individual modules.
 */

// -- Player --
export const PLAYER_MOVE_SPEED = 32;        // units per second
export const PLAYER_WORLD_LIMIT = 120;      // clamp position to ±limit
export const PLAYER_TARGET_HEIGHT = 10.0;   // avatar scale target (units)
export const ANIMATION_CROSSFADE = 0.25;    // seconds for idle↔run blend

// -- Camera --
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 1000;
export const CAMERA_ORBIT_DISTANCE = 28;
export const CAMERA_ORBIT_HEIGHT = 12;
export const CAMERA_LOOK_Y_WITH_MODEL = 4.0;
export const CAMERA_LOOK_Y_WITHOUT_MODEL = 2.0;
export const CAMERA_ORBIT_SENSITIVITY = 0.006; // radians per pixel of mouse movement

// -- World --
export const GROUND_SIZE = 300;
export const SKY_RADIUS = 400;
export const FOG_DENSITY = 0.006;
export const TREE_COUNT = 18;
export const TREE_MIN_DIST = 30;
export const TREE_MAX_DIST = 56;
export const TREE_CLEARANCE = 4;            // min distance between trees

// -- Portals --
export const PORTAL_ROW_Z = -10;
export const PORTAL_ROW_SPACING = 12;
export const PORTAL_PROXIMITY_DIST = 14;
export const PORTAL_ENTER_DIST = 5;
export const PORTAL_CUSTOM_REF_ENTER_DIST = 6;
export const PORTAL_PIETER_ELEVATION_Y = 4.0;
export const PORTAL_PIETER_X = 18;

// -- Renderer --
export const MAX_PIXEL_RATIO = 2;
export const TONE_MAPPING_EXPOSURE = 1.2;
export const SHADOW_MAP_SIZE = 2048;

// -- Animation --
export const MAX_DELTA = 0.1;               // clamp frame delta to prevent physics jumps
