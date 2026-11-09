/** Camera settings. The camera keeps this angle and moves closer or further to fit the screen. */
export const VIEW = {
  /** Vertical field of view in degrees. Low values flatten the perspective. */
  fov: 38,
  /** Direction the camera looks from, relative to the room centre (height, distance towards the front). */
  from: { y: 15.5, z: 13.2 },
  /** Point on the floor the camera aims at (slightly forward of centre). */
  aimZ: 0.3,
  /**
   * On tall, narrow screens (phones held upright) showing the whole room would
   * make everything tiny. If fitting the width needs the camera further back
   * than this many times the distance that fits the depth, the camera instead
   * zooms in and slides sideways to follow the waiter.
   */
  followWhenWidthNeeds: 1.3,
  /** When following, how far back the camera sits, relative to the distance that just fits the depth. */
  followZoomOut: 1.15,
  /** How quickly the camera catches up when following (higher is snappier). */
  followRate: 5,
  /** Gap kept between the room and the screen edges, in pixels. */
  edgeGap: 8,
};
