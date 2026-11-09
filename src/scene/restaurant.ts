import * as THREE from 'three';
import type { RestaurantLayout, Station, TableSpot } from '../data/types';
import { canvasTexture, mesh, place, toon } from './materials';
import { makeLabel, makeNumberBadge, replaceSpriteTexture } from './labels';
import { PALETTE } from './palette';

const HAND_FONT = 'Kalam, "Segoe Print", cursive';

/** One place at a table: where the guest sits, which way they face, and where their plate and glass go. */
export interface Seat {
  pos: THREE.Vector3;
  heading: number;
  plate: THREE.Vector3;
  glass: THREE.Vector3;
}

export interface TableView {
  spot: TableSpot;
  /** Four seats: back (the solo guest's seat), left, right, front. */
  seats: Seat[];
}

/** Seat directions from the table centre, in the order guests fill them. */
const SEAT_DIRS: [number, number][] = [[0, -1], [-1, 0], [1, 0], [0, 1]];

export interface RestaurantView {
  tables: TableView[];
  /** Redraws text on signs and labels; call once web fonts have loaded. */
  redrawText(): void;
}

/** Builds the whole dining room from the layout data. */
export function buildRestaurant(scene: THREE.Scene, L: RestaurantLayout): RestaurantView {
  const halfW = L.floor.width / 2;
  const halfD = L.floor.depth / 2;

  // Floor: a checkerboard texture repeated across the room.
  const floorTex = canvasTexture(128, 128, (c, w) => {
    c.fillStyle = PALETTE.floorLight;
    c.fillRect(0, 0, w, w);
    c.fillStyle = PALETTE.floorDark;
    c.fillRect(0, 0, 64, 64);
    c.fillRect(64, 64, 64, 64);
  }, [L.floor.width / 2, L.floor.depth / 2]);
  const floor = mesh(new THREE.PlaneGeometry(L.floor.width, L.floor.depth), toon(0xffffff, { map: floorTex }), false);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Walls: tall at the back, low on the sides so the camera can see over them.
  const backZ = -halfD - 0.15;
  place(scene, mesh(new THREE.BoxGeometry(L.floor.width + 0.6, L.backWallHeight, 0.3), toon(PALETTE.wall)), 0, L.backWallHeight / 2, backZ);
  place(scene, mesh(new THREE.BoxGeometry(L.floor.width + 0.6, 1.1, 0.34), toon(PALETTE.wainscot)), 0, 0.55, backZ + 0.03);
  const sideH = L.sideWallHeight;
  place(scene, mesh(new THREE.BoxGeometry(0.3, sideH, L.floor.depth + 0.3), toon(PALETTE.wall)), halfW + 0.15, sideH / 2, 0);
  const leftStart = -halfD - 0.15;
  const leftEnd = L.doorway.minZ - 0.05;
  place(scene, mesh(new THREE.BoxGeometry(0.3, sideH, leftEnd - leftStart), toon(PALETTE.wall)), -halfW - 0.15, sideH / 2, (leftStart + leftEnd) / 2);

  buildDoor(scene, L, halfW);
  for (const s of L.stations) {
    if (s.kind === 'pass') buildPass(scene, s, halfD);
    if (s.kind === 'bar') buildBar(scene, s, halfD);
  }

  // Glowing sign over the back wall.
  const signMat = new THREE.MeshBasicMaterial({ transparent: true });
  place(scene, mesh(new THREE.PlaneGeometry(4.2, 1.0), signMat, false), 0, 2.6, -halfD + 0.01);
  const drawSign = () => {
    signMat.map?.dispose();
    signMat.map = canvasTexture(512, 128, (c) => {
      c.fillStyle = PALETTE.sign;
      c.font = `700 78px ${HAND_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = PALETTE.signGlow;
      c.shadowBlur = 18;
      c.fillText(L.signText, 256, 66);
    });
    signMat.needsUpdate = true;
  };
  drawSign();

  for (const p of L.plants) {
    place(scene, mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 10), toon(PALETTE.planter)), p.x, 0.3, p.z);
    place(scene, mesh(new THREE.IcosahedronGeometry(0.75, 0), toon(PALETTE.leaves)), p.x, 1.15, p.z);
  }

  const stationLabels = L.stations.map((s) => {
    const label = makeLabel(s.label);
    place(scene, label, s.labelAt.x, s.labelAt.y, s.labelAt.z);
    return { label, text: s.label };
  });

  const tables = L.tables.map((t) => buildTable(scene, L, t));
  const badges = tables.map((t) => t.badge);

  return {
    tables: tables.map((t) => t.view),
    redrawText() {
      drawSign();
      for (const s of stationLabels) replaceSpriteTexture(s.label, makeLabel(s.text));
      badges.forEach((b, i) => replaceSpriteTexture(b, makeNumberBadge(L.tables[i].number)));
    },
  };
}

function buildDoor(scene: THREE.Scene, L: RestaurantLayout, halfW: number): void {
  const x = -halfW - 0.15;
  const { minZ, maxZ, height } = L.doorway;
  const frame = toon(PALETTE.doorFrame);
  place(scene, mesh(new THREE.BoxGeometry(0.34, height, 0.2), frame), x, height / 2, minZ);
  place(scene, mesh(new THREE.BoxGeometry(0.34, height, 0.2), frame), x, height / 2, maxZ);
  place(scene, mesh(new THREE.BoxGeometry(0.34, 0.25, maxZ - minZ + 0.2), frame), x, height, (minZ + maxZ) / 2);
  const door = L.stations.find((s) => s.kind === 'door');
  if (door) {
    const mat = mesh(new THREE.PlaneGeometry(1.8, maxZ - minZ - 0.8), toon(PALETTE.doorMat), false);
    mat.rotation.x = -Math.PI / 2;
    place(scene, mat, door.center.x, 0.01, door.center.z);
  }
  place(scene, mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), toon(PALETTE.podium)), L.podium.x, 0.55, L.podium.z);
}

function buildPass(scene: THREE.Scene, s: Station, halfD: number): void {
  const { x, z } = s.center;
  place(scene, mesh(new THREE.PlaneGeometry(5.2, 1.5), new THREE.MeshBasicMaterial({ color: PALETTE.passWindow }), false), x, 2.05, -halfD + 0.02);
  place(scene, mesh(new THREE.BoxGeometry(5.6, 0.18, 0.3), toon(PALETTE.passHood)), x, 2.85, -halfD + 0.05);
  place(scene, mesh(new THREE.BoxGeometry(5.6, 1.0, 1.0), toon(PALETTE.passCounter)), x, 0.5, z);
  place(scene, mesh(new THREE.BoxGeometry(5.8, 0.1, 1.15), toon(PALETTE.passTop)), x, 1.05, z);
}

function buildBar(scene: THREE.Scene, s: Station, halfD: number): void {
  const { x, z } = s.center;
  place(scene, mesh(new THREE.BoxGeometry(5.6, 1.0, 1.0), toon(PALETTE.barCounter)), x, 0.5, z);
  place(scene, mesh(new THREE.BoxGeometry(5.8, 0.1, 1.15), toon(PALETTE.barTop)), x, 1.05, z);
  place(scene, mesh(new THREE.BoxGeometry(5.2, 0.08, 0.35), toon(PALETTE.barShelf)), x, 2.2, -halfD + 0.1);
  const bottle = new THREE.CylinderGeometry(0.08, 0.09, 0.42, 8);
  for (let i = 0; i < 12; i++) {
    place(scene, mesh(bottle, toon(PALETTE.bottles[i % PALETTE.bottles.length])), x - 2.2 + i * 0.4, 2.45, -halfD + 0.12);
  }
  const glass = new THREE.CylinderGeometry(0.1, 0.08, 0.2, 10);
  const glassMat = toon(PALETTE.glass, { transparent: true, opacity: 0.75 });
  for (let i = 0; i < 5; i++) place(scene, mesh(glass, glassMat), x - 1.3 + i * 0.55, 1.2, z + 0.15);
}

const clothTexture = () =>
  canvasTexture(64, 64, (c) => {
    c.fillStyle = PALETTE.clothLight;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = PALETTE.clothCheck;
    c.fillRect(0, 0, 32, 64);
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = PALETTE.clothCheckDark;
    c.fillRect(0, 0, 32, 32);
  }, [3, 3]);

let sharedCloth: THREE.CanvasTexture | null = null;

function buildTable(scene: THREE.Scene, L: RestaurantLayout, t: TableSpot): { view: TableView; badge: THREE.Sprite } {
  sharedCloth ??= clothTexture();
  const r = L.tableRadius;
  place(scene, mesh(new THREE.CylinderGeometry(r, r, 0.09, 24), toon(0xffffff, { map: sharedCloth })), t.x, 0.82, t.z);
  place(scene, mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.07, 0.3, 24, 1, true), toon(PALETTE.clothSkirt, { side: THREE.DoubleSide })), t.x, 0.65, t.z);
  place(scene, mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), toon(PALETTE.tableLeg)), t.x, 0.4, t.z);
  place(scene, mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8), toon(PALETTE.candle)), t.x, 0.98, t.z);
  place(scene, mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: PALETTE.flame }), false), t.x, 1.13, t.z);

  const seats: Seat[] = SEAT_DIRS.map(([dx, dz]) => {
    // Guests face the table centre.
    const heading = Math.atan2(-dx, -dz);
    const chair = new THREE.Group();
    const seatMesh = mesh(new THREE.BoxGeometry(0.7, 0.08, 0.6), toon(PALETTE.chair));
    seatMesh.position.y = 0.5;
    const backrest = mesh(new THREE.BoxGeometry(0.7, 0.75, 0.08), toon(PALETTE.chair));
    backrest.position.set(0, 0.9, -0.28);
    chair.add(seatMesh, backrest);
    chair.rotation.y = heading;
    place(scene, chair, t.x + dx * L.chairOffset, 0, t.z + dz * L.chairOffset);
    // Plate in front of the guest, glass to their right.
    const rx = -dz, rz = dx;
    return {
      pos: new THREE.Vector3(t.x + dx * L.chairOffset, 0.04, t.z + dz * L.chairOffset),
      heading,
      plate: new THREE.Vector3(t.x + dx * 0.5, 0.88, t.z + dz * 0.5),
      glass: new THREE.Vector3(t.x + dx * 0.55 - rx * 0.4, 0.97, t.z + dz * 0.55 - rz * 0.4),
    };
  });

  const badge = makeNumberBadge(t.number);
  place(scene, badge, t.x + 1.0, 0.25, t.z + 0.9);

  return {
    badge,
    view: { spot: t, seats },
  };
}
