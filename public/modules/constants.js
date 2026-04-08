/**
 * Tunable game constants. Centralised here so agents and developers can
 * adjust game feel without hunting through individual modules.
 */

// -- Player --
export const PLAYER_MOVE_SPEED = 32;        // units per second
/**
 * Player starts at this +Z — the far (+Z) end of the open spawn area; hub row stays toward −Z.
 */
export const PLAYER_SPAWN_Z = 100;
export const PLAYER_WORLD_LIMIT = 300;      // clamp position to ±limit
export const PLAYER_TARGET_HEIGHT = 10.0;   // avatar scale target (units)
export const ANIMATION_CROSSFADE = 0.25;    // seconds for idle↔run blend
/** Hare GLB walk/idle clips are authored slow vs. PLAYER_MOVE_SPEED; scale playback so legs match travel. */
export const AVATAR_HARE_IDLE_TIME_SCALE = 1.2;
export const AVATAR_HARE_LOCOMOTION_TIME_SCALE = 1.2;

export const DEFAULT_PLAYER_NAME = 'metaverse-explorer';

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
/** Trees avoid this radius around world origin (0,0,0); ring of trees sits outside this disk. */
export const TREE_CENTER_CLEAR_RADIUS = 110;

// -- Portals --
/** Added to every portal world X (row, Pieter torus, return torus). */
export const PORTAL_GLOBAL_X_OFFSET = -25;
export const PORTAL_ROW_Z = -12;
/** Horizontal gap between portal slots (wider = clearer of avatar arms in T-pose). */
export const PORTAL_ROW_SPACING = 18;
/** Shift the whole row in +X (negative = left on screen) so the right portal clears the Jam widget. */
export const PORTAL_ROW_OFFSET_X = -5;
/** Extra +X on the Pieter torus only (pushes it further right vs the shader row). */
export const PORTAL_PIETER_TORUS_EXTRA_X = 12;
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
/** Used for the custom return portal (?portal) — right flank X (see PORTAL_ROW_OFFSET_X). */
export const PORTAL_PIETER_X = 18;
/**
 * Custom return portal (?portal) sits this far along +Z past {@link PLAYER_SPAWN_Z}
 * (directly behind spawn on X=0).
 */
export const PORTAL_RETURN_BEHIND_SPAWN = 15;
/** World Z for the red return torus — derived so it tracks spawn. */
export const PORTAL_RETURN_Z = PLAYER_SPAWN_Z + PORTAL_RETURN_BEHIND_SPAWN;

// -- Renderer --
export const MAX_PIXEL_RATIO = 2;
export const TONE_MAPPING_EXPOSURE = 1.1;
export const SHADOW_MAP_SIZE = 2048;
export const SUN_INTENSITY = 1.0;
export const SUN_POSITION = [50, 40, 30];
export const AMBIENT_INTENSITY = 0.55;
export const HEMI_INTENSITY = 0.65;
export const SHADOW_RADIUS = 4;
export const SHADOW_NORMAL_BIAS = 0.02;

// -- Animation --
export const MAX_DELTA = 0.1;               // clamp frame delta to prevent physics jumps

// -- Multiplayer --
/** Minimum ms between network position updates (client send). */
export const MULTIPLAYER_SEND_INTERVAL_MS = 50;
/** Higher = snappier remote position catch-up (exponential lerp factor). */
export const MULTIPLAYER_REMOTE_LERP = 18;
