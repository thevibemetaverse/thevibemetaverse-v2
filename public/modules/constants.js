/**
 * Tunable game constants. Centralised here so agents and developers can
 * adjust game feel without hunting through individual modules.
 */

// -- Player --
export const PLAYER_MOVE_SPEED = 32;        // units per second
export const PLAYER_WORLD_LIMIT = 300;      // clamp position to ±limit
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
export const CAMERA_ORBIT_SENSITIVITY_TOUCH = 0.012; // radians per pixel of touch drag

// -- World --
export const GROUND_SIZE = 800;
export const SKY_RADIUS = 800;
export const FOG_DENSITY = 0.004;
export const TREE_COUNT = 30;
export const TREE_MIN_DIST = 40;
export const TREE_MAX_DIST = 250;
export const TREE_CLEARANCE = 10;           // min distance between trees (larger for bigger trees)

// -- Portals --
/** Lateral gap between the two parallel hallway lines (each line is ± half this value from center). */
export const PORTAL_ROW_SPACING = 30;
export const PORTAL_HALLWAY_LANE_HALF = PORTAL_ROW_SPACING / 2;
/** First registry portal sits at this Z; deeper portals use more negative Z. */
export const PORTAL_HALLWAY_START_Z = -10;
/** Distance along -Z between consecutive portals in the alternating hallway. */
export const PORTAL_HALLWAY_DEPTH_STEP = 16;
/** Extra -Z past the last registry/hub portal before Pieter’s terminal portal (center). */
export const PORTAL_PIETER_TERMINAL_GAP = 10;
/** Return portal (?portal) sits at +Z — behind spawn when facing the hallway. */
export const PORTAL_RETURN_Z = 18;
/** Shift the whole hallway in +X (negative = left on screen) so the flank clears the Jam widget. */
export const PORTAL_ROW_OFFSET_X = -5;
/** Spawn X/Z — same X as the portal hallway midline so the player starts centered in the corridor. */
export const PLAYER_SPAWN_X = PORTAL_ROW_OFFSET_X;
export const PLAYER_SPAWN_Z = 0;
/**
 * Horizontal (XZ) distance: show “Entering…” when this close on the ground plane.
 * (Portal groups sit above the player in Y — 3D distance would ignore these knobs.)
 */
export const PORTAL_PROXIMITY_DIST = 5;
/** Horizontal (XZ) distance: registry portals navigate when closer than this. */
export const PORTAL_ENTER_DIST = 1.5;
/** Horizontal (XZ) distance: Pieter torus + custom ref portal navigate when closer than this. */
export const PORTAL_CUSTOM_REF_ENTER_DIST = 1.5;
/** World Y for portal groups; slightly raised so rings sit above shoulder height after mesh offset × scale. */
export const PORTAL_PIETER_ELEVATION_Y = 4.9;

// -- Renderer --
export const MAX_PIXEL_RATIO = 2;
export const TONE_MAPPING_EXPOSURE = 1.2;
export const SHADOW_MAP_SIZE = 2048;

// -- Animation --
export const MAX_DELTA = 0.1;               // clamp frame delta to prevent physics jumps
