// 3D bus models for the map, both in Stadtwerke Osnabrück liveries:
// - "metro":    18 m VDL Citea SLFA Electric (articulated) in the green "MetroBus" livery, lines M1–M5
// - "standard": 12 m solo e-bus in the regular SWO Mobil livery (red front, checker pattern, white body), all other lines
// Section-local meters: front = +x, left = +y, up = +z. Each livery is painted once into a canvas atlas; bodies are
// rounded boxes that pick their atlas cell per triangle. A model is a list of rigid sections, each spanning
// [from, to] meters behind the bus front, so articulated buses can bend along the road.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const HALF_W = 1.275, Z0 = 0.3, Z1 = 3.05, CHASSIS_TOP = 1.0;
const ARCH_R = 0.56, EDGE_R = 0.42; // wheel arch radius, rounded body edges like the real buses
const RED = "#e2001a", PINK = "#f39bb0", WHITE = "#f2f3f4", WINDOW = "#1d2126";

// ---------- atlas layout (shared by both liveries) ----------
const AW = 2048, AH = 1024;
type Cell = [x: number, y: number, w: number, h: number];
const SIDE_A_R: Cell = [0, 0, 1024, 300], SIDE_A_L: Cell = [1024, 0, 1024, 300];   // first section, right / left
const SIDE_B_R: Cell = [0, 300, 1024, 300], SIDE_B_L: Cell = [1024, 300, 1024, 300]; // second section (articulated)
const FRONT: Cell = [0, 600, 512, 420], REAR: Cell = [512, 600, 512, 420];
const ROOF: Cell = [1024, 600, 128, 128], UNDER: Cell = [1152, 600, 128, 128], JOINT: Cell = [1280, 600, 128, 128];

type Side = "right" | "left";
type Opening = [g0: number, g1: number, door: boolean];
// g = meters from the rear end of the bus; X/Y map body coordinates to canvas pixels of one side panel
type Panel = { ctx: CanvasRenderingContext2D; X: (g: number) => number; Y: (z: number) => number; side: Side; gFrom: number; gTo: number; x0: number; y0: number; w: number; h: number };
type Livery = { openings: Record<Side, Opening[]>; axles: number[]; under: (p: Panel) => void; over: (p: Panel) => void };

// the viewer of the right side sees the front on the right, the viewer of the left side on the left
function paintSide(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: Cell, gFrom: number, gTo: number, side: Side, livery: Livery) {
  const X = (g: number) => x0 + ((side === "right" ? g - gFrom : gTo - g) / (gTo - gFrom)) * w;
  const Y = (z: number) => y0 + h - ((z - Z0) / (Z1 - Z0)) * h;
  const p: Panel = { ctx, X, Y, side, gFrom, gTo, x0, y0, w, h };
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  livery.under(p);
  for (const [g0, g1, door] of livery.openings[side]) {
    if (g1 < gFrom || g0 > gTo) continue;
    const xa = Math.min(X(g0), X(g1)), xb = Math.max(X(g0), X(g1));
    const top = Y(2.47), bottom = Y(door ? 0.4 : 1.28);
    ctx.fillStyle = WINDOW; ctx.fillRect(xa, top, xb - xa, bottom - top);
    ctx.strokeStyle = "#3d444c"; ctx.lineWidth = 3;
    if (door) {
      ctx.strokeRect(xa + 2, top + 2, xb - xa - 4, bottom - top - 4);
      ctx.beginPath(); ctx.moveTo((xa + xb) / 2, top); ctx.lineTo((xa + xb) / 2, bottom); ctx.stroke();
    } else {
      for (let g = g0 + 1.4; g < g1 - 0.3; g += 1.4) { ctx.beginPath(); ctx.moveTo(X(g), top); ctx.lineTo(X(g), bottom); ctx.stroke(); }
    }
  }
  livery.over(p);
  // cut the wheel arches out (transparent, alphaTest) so the wheels show
  ctx.globalCompositeOperation = "destination-out";
  for (const g of livery.axles) {
    if (g < gFrom || g > gTo) continue;
    ctx.beginPath(); ctx.ellipse(X(g), Y(0.5), (ARCH_R * w) / (gTo - gFrom), (ARCH_R * h) / (Z1 - Z0), 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// fill the band between two g positions (handles the mirrored left side)
function band({ ctx, X, Y }: Panel, g0: number, g1: number, z0: number, z1: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.min(X(g0), X(g1)), Y(z1), Math.abs(X(g1) - X(g0)), Y(z0) - Y(z1));
}

function chevrons(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: number, size: number) {
  ctx.strokeStyle = "#fff"; ctx.lineWidth = size / 5;
  for (const d of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(cx - dir * size * 0.25 + d * size * 0.7, cy - size * 0.4);
    ctx.lineTo(cx + dir * size * 0.2 + d * size * 0.7, cy); ctx.lineTo(cx - dir * size * 0.25 + d * size * 0.7, cy + size * 0.4); ctx.stroke();
  }
}

function paintFront(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: Cell, display: string, label: string) {
  const Y = (z: number) => y0 + h - ((z - Z0) / (Z1 - Z0)) * h;
  ctx.fillStyle = RED; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = "#14171b"; ctx.beginPath(); ctx.roundRect(x0 + 24, Y(Z1), w - 48, Y(0.95) - Y(Z1), 28); ctx.fill(); // windshield
  ctx.fillStyle = "#050607"; ctx.fillRect(x0 + 60, Y(2.68), w - 120, Y(2.38) - Y(2.68));
  ctx.fillStyle = "#ffb000"; ctx.font = "bold 26px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(display, x0 + w / 2, Y(2.53));
  ctx.fillStyle = "#f4f6f8";
  ctx.beginPath(); ctx.roundRect(x0 + 34, Y(0.72), 86, 22, 8); ctx.roundRect(x0 + w - 120, Y(0.72), 86, 22, 8); ctx.fill(); // headlights
  ctx.font = "bold 24px sans-serif"; ctx.fillText(label, x0 + w / 2, Y(0.62));
  ctx.fillStyle = "#1a1c1f"; ctx.fillRect(x0, Y(0.42), w, Y(Z0) - Y(0.42)); // bumper
}

function paintRear(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: Cell, top: string) {
  const Y = (z: number) => y0 + h - ((z - Z0) / (Z1 - Z0)) * h;
  ctx.fillStyle = top; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = RED; ctx.fillRect(x0, Y(1.45), w, Y(Z0) - Y(1.45));
  ctx.fillStyle = WINDOW; ctx.beginPath(); ctx.roundRect(x0 + 50, Y(2.85), w - 100, Y(1.7) - Y(2.85), 18); ctx.fill();
  chevrons(ctx, x0 + w / 2, Y(1.05), 1, 44);
  ctx.fillStyle = "#1a1c1f"; ctx.fillRect(x0, Y(0.5), w, Y(Z0) - Y(0.5));
}

function atlas(paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = AW; canvas.height = AH;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  for (const [cell, color] of [[ROOF, "#e6e9ec"], [UNDER, "#1a1c1f"], [JOINT, "#3a3f45"]] as const) { ctx.fillStyle = color; ctx.fillRect(...cell); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- MetroBus livery (VDL Citea SLFA, 18 m) ----------
export const METRO = { rear: 7.4, bellows: 1.55, front: 9.05 };
const M_TOTAL = METRO.rear + METRO.bellows + METRO.front;
const M_FRONT_G = METRO.rear + METRO.bellows; // where the front section starts

const LIME = [196, 218, 24], ORANGE = [242, 122, 18], RED_RGB = [226, 0, 26];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function metroColor(g: number) {
  const t = Math.min(1, Math.max(0, (g - 15.2) / 1.8)); // lime body turns red towards the front
  return `rgb(${t < 0.5 ? mix(LIME, ORANGE, t * 2) : mix(ORANGE, RED_RGB, (t - 0.5) * 2)})`;
}
// [z, amplitude, frequency, phase, line width px, color]: waves in g-space so they flow across both sections
const SWOOSHES: [number, number, number, number, number, string][] = [
  [0.7, 0.35, 0.55, 0.3, 26, "rgba(20,110,30,0.75)"],
  [1.05, 0.3, 0.42, 2.1, 10, "rgba(10,70,20,0.85)"],
  [0.55, 0.25, 0.8, 4.0, 8, "rgba(250,255,120,0.6)"],
  [2.75, 0.18, 0.5, 1.0, 16, "rgba(25,120,35,0.7)"],
  [2.85, 0.12, 0.9, 3.3, 5, "rgba(10,70,20,0.8)"],
  [2.62, 0.1, 0.65, 5.2, 6, "rgba(250,255,140,0.55)"],
];
// placed in the free panels between doors and wheel arches (arches: g 2.7–3.9, 9.4–10.5, 14.7–15.9)
const METRO_TEXTS: Record<Side, [string, number, number][]> = { // [text, g, z]
  right: [["MetroBus", 4.0, 2.72], ["MetroBus", 13.2, 2.72], ["[Wir]", 6.85, 0.8], ["[fahren]", 13.05, 0.8], ["[Strom!]", 14.2, 0.8]],
  left: [["MetroBus", 6.5, 2.72], ["MetroBus", 13.1, 2.72], ["[Strom!]", 11.2, 0.8], ["[fahren]", 12.5, 0.8], ["[Wir]", 13.7, 0.8]],
};
const SMILEYS: Record<Side, number[]> = { right: [4.0, 4.45, 4.9], left: [4.5, 5.3, 6.1] };

const metroLivery: Livery = {
  axles: [3.3, M_FRONT_G + 1.0, M_TOTAL - 2.7],
  // right side (passenger side) has the doors; left side is one long window band
  openings: {
    right: [[0.3, 1.0, false], [1.0, 2.3, true], [2.3, 5.05, false], [5.05, 6.35, true], [6.35, 7.3, false],
      [M_FRONT_G + 0.15, 11.1, false], [11.1, 12.5, true], [12.5, 16.2, false], [16.2, 17.3, true], [17.3, 17.85, false]],
    left: [[0.3, 7.3, false], [M_FRONT_G + 0.15, 17.85, false]],
  },
  under({ ctx, X, Y, gFrom, gTo, x0, y0, w, h }) {
    const grad = ctx.createLinearGradient(X(gFrom), 0, X(gTo), 0);
    for (let k = 0; k <= 24; k++) grad.addColorStop(k / 24, metroColor(gFrom + ((gTo - gFrom) * k) / 24));
    ctx.fillStyle = grad; ctx.fillRect(x0, y0, w, h);
    const shade = ctx.createLinearGradient(0, y0, 0, y0 + h);
    shade.addColorStop(0, "rgba(255,255,150,0.25)"); shade.addColorStop(1, "rgba(0,70,0,0.3)");
    ctx.fillStyle = shade; ctx.fillRect(x0, y0, w, h);
    for (const [z, amp, k, ph, lw, color] of SWOOSHES) {
      ctx.beginPath();
      for (let g = gFrom; g <= Math.min(gTo, 16.4); g += 0.1) {
        const y = Y(z + amp * Math.sin(g * k + ph) + 0.08 * Math.sin(g * 2.3 + ph));
        if (g === gFrom) ctx.moveTo(X(g), y); else ctx.lineTo(X(g), y);
      }
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.stroke();
    }
  },
  over({ ctx, X, Y, side, gFrom, gTo }) {
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const [text, g, z] of METRO_TEXTS[side]) {
      if (g < gFrom || g > gTo) continue;
      ctx.font = text === "MetroBus" ? "italic bold 30px sans-serif" : "bold 30px sans-serif";
      ctx.fillText(text, X(g), Y(z));
    }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
    SMILEYS[side].forEach((g, i) => {
      if (g < gFrom || g > gTo) return;
      const cx = X(g), cy = Y(0.8);
      ctx.beginPath(); ctx.arc(cx, cy, 19, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - 7, cy - 5, 3, 0, Math.PI * 2); ctx.arc(cx + 7, cy - 5, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath();
      if (i === 1) { ctx.moveTo(cx - 8, cy + 8); ctx.lineTo(cx + 8, cy + 8); } // smile, neutral, big smile
      else ctx.arc(cx, cy + 2, i === 0 ? 8 : 11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    });
    if (gFrom === 0) { // SWO chevron logo at the rear end
      const cx = X(0), cy = Y(2.0);
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fill();
      chevrons(ctx, cx + (side === "right" ? 14 : -14), cy, side === "right" ? 1 : -1, 30);
    }
  },
};

// ---------- standard SWO Mobil livery (12 m solo e-bus) ----------
const S_LEN = 12.1;
const S_RED_FROM = S_LEN - 3.3; // red front zone ends just before the front wheel, followed by the checker pattern
const standardLivery: Livery = {
  axles: [3.4, S_LEN - 2.8],
  openings: {
    right: [[0.9, 4.9, false], [4.9, 6.2, true], [6.2, 10.75, false], [10.75, 11.85, true]],
    left: [[0.9, 11.85, false]],
  },
  under(p) {
    const { ctx, X, Y, x0, y0, w, h } = p;
    ctx.fillStyle = WHITE; ctx.fillRect(x0, y0, w, h);
    // light grey city skyline along the lower body (as on the eCitaro), deterministic so both sides match
    ctx.fillStyle = "#dfe2e6";
    for (let g = 0.6, k = 0; g < S_RED_FROM - 0.9; k++) {
      const bw = 0.35 + 0.25 * ((Math.sin(k * 12.9898) + 1) / 2), top = 0.75 + 0.35 * ((Math.sin(k * 78.233) + 1) / 2);
      band(p, g, g + bw, Z0, top, "#dfe2e6");
      if (k % 4 === 1) { // church spire
        ctx.beginPath(); ctx.moveTo(X(g), Y(top)); ctx.lineTo(X(g + bw / 2), Y(top + 0.35)); ctx.lineTo(X(g + bw), Y(top)); ctx.fill();
      }
      g += bw + 0.05;
    }
    band(p, S_RED_FROM, S_LEN, Z0, 1.28, RED);     // red lower front
    band(p, S_LEN - 1.7, S_LEN, 2.47, Z1, RED);     // red roof edge above the windshield
    band(p, S_LEN - 0.5, S_LEN, Z0, Z1, RED);       // red front corner
    // checker pattern fading from the red zone into the white body
    const s = 0.19, colors = [[RED, PINK], [PINK, null], ["#fbd0da", null]];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 5; r++) {
      const color = colors[c][(r + c) % 2];
      if (color) band(p, S_RED_FROM - (c + 1) * s, S_RED_FROM - c * s, 0.35 + r * s, 0.35 + (r + 1) * s, color);
    }
    band(p, 0, S_LEN, Z0, 0.36, "#c9cdd2"); // skirt line
  },
  over({ ctx, X, Y }) {
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 30px sans-serif";
    ctx.fillText("SWO Mobil", X(S_LEN - 1.25), Y(0.62));
  },
};

// ---------- geometry ----------
function part(geo: THREE.BufferGeometry, hex: number) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}
const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, hex: number) =>
  part(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), hex);
const wheel = (x: number, y: number) => [
  part(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 18).translate(x, y, 0.5), 0x0b0b0b), // tyre, axis = lateral
  part(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 18).translate(x, y + Math.sign(y) * 0.16, 0.5), 0xf2f2f2), // white hub cover
];
const axle = (x: number) => [...wheel(x, -1.13), ...wheel(x, 1.13)];
const fan = (x: number, y: number) => part(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14).rotateX(Math.PI / 2).translate(x, y, 3.39), 0x2a2e33);
const batteries = (x: number) => [box(1.0, 0.8, 0.24, x, -0.44, 3.17, 0x3d434a), box(1.0, 0.8, 0.24, x, 0.44, 3.17, 0x3d434a)];
const acUnit = (x: number, len: number) => [box(len, 1.7, 0.3, x, 0, 3.2, 0xf4f5f6), fan(x - len / 4, -0.5), fan(x - len / 4, 0.5), fan(x + len / 4, -0.5), fan(x + len / 4, 0.5)];
const chassis = (len: number) => box(len - 2 * EDGE_R, 1.8, CHASSIS_TOP - Z0, 0, 0, (CHASSIS_TOP + Z0) / 2, 0x26292d); // seen through the arches
// rounded slab: RoundedBox clamps the radius to the smallest side, so build it 1 m long and squash it
const roundedSlab = (sx: number, sy: number, sz: number, r: number, x: number, z: number, hex: number) =>
  part(new RoundedBoxGeometry(1, sy, sz, 3, r).scale(sx, 1, 1).translate(x, 0, z), hex);

// One rounded body per section. Each triangle picks its atlas cell from its face normal (side, end, roof, underside),
// then gets a planar projection: the livery wraps around the rounded edges without smearing across cells.
function shellGeometry(len: number, right: Cell, left: Cell, front: Cell, rear: Cell) {
  const geo = new RoundedBoxGeometry(len, HALF_W * 2, Z1 - Z0, 5, EDGE_R).translate(0, 0, (Z0 + Z1) / 2).toNonIndexed();
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const set = (k: number, [cx, cy, cw, ch]: Cell, u: number, v: number) => uv.setXY(k, (cx + u * cw) / AW, 1 - (cy + (1 - v) * ch) / AH);
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
    n.subVectors(b, a).cross(c.sub(a)).normalize();
    for (let k = t; k < t + 3; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const v = Math.min(1, Math.max(0, (z - Z0) / (Z1 - Z0)));
      const s = (y + HALF_W) / (2 * HALF_W);
      if (n.z > 0.7) set(k, ROOF, 0.5, 0.5);
      else if (n.z < -0.9) set(k, UNDER, 0.5, 0.5);
      else if (Math.abs(n.y) >= Math.abs(n.x)) {
        const along = (x + len / 2) / len; // the right side is seen with the front on the right, the left side mirrored
        set(k, n.y < 0 ? right : left, n.y < 0 ? along : 1 - along, v);
      } else if (n.x > 0) set(k, front, front === JOINT ? 0.5 : s, v);
      else set(k, rear, rear === JOINT ? 0.5 : 1 - s, v); // viewer behind the bus has the bus's right on their left
    }
  }
  return geo;
}

export type Section = { meshes: THREE.InstancedMesh[]; from: number; to: number };
export type BusModel = { sections: Section[]; tagAt: number; count: number };

export function createBusModels(max: number) {
  const painted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
  const lights = new THREE.MeshBasicMaterial({ vertexColors: true });
  const liveryMaterial = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.1, alphaTest: 0.5 });
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  };
  const headlights = (fx: number, display: number) => [
    box(0.04, 0.3, 0.11, fx + 0.02, 0.7, 0.66, 0xfff6dd), box(0.04, 0.3, 0.11, fx + 0.02, -0.7, 0.66, 0xfff6dd),
    box(0.04, display, 0.26, fx + 0.02, 0, 2.53, 0x6a4700), // destination display glow
  ];
  const tailLights = (rx: number) => [box(0.04, 0.16, 0.5, -rx - 0.02, 0.78, 0.95, 0xff2020), box(0.04, 0.16, 0.5, -rx - 0.02, -0.78, 0.95, 0xff2020)];

  // --- metro (articulated) ---
  const metroTex = atlas((ctx) => {
    paintSide(ctx, SIDE_A_R, M_FRONT_G, M_TOTAL, "right", metroLivery);
    paintSide(ctx, SIDE_A_L, M_FRONT_G, M_TOTAL, "left", metroLivery);
    paintSide(ctx, SIDE_B_R, 0, METRO.rear, "right", metroLivery);
    paintSide(ctx, SIDE_B_L, 0, METRO.rear, "left", metroLivery);
    paintFront(ctx, FRONT, "Stadtwerke Osnabrück", "SWO");
    paintRear(ctx, REAR, RED);
  });
  const metroMat = liveryMaterial(metroTex);
  const fx = METRO.front / 2, rx = METRO.rear / 2;
  const toFront = (g: number) => g - (M_FRONT_G + fx), toRear = (g: number) => g - rx;
  const [rearAxle, middleAxle, frontAxle] = metroLivery.axles;
  const metro: BusModel = {
    count: 0, tagAt: METRO.front,
    sections: [
      { from: 0, to: METRO.front, meshes: [
        instanced(mergeGeometries([
          chassis(METRO.front), ...axle(toFront(frontAxle)), ...axle(toFront(middleAxle)),
          ...acUnit(-2.4, 2.6), ...batteries(0.4), ...batteries(1.5),
          box(1.6, 0.07, 0.12, 3.4, -0.35, 3.13, 0x111111), box(1.6, 0.07, 0.12, 3.4, 0.35, 3.13, 0x111111), // charging rails
          box(1.2, 0.06, 0.06, 2.6, 0.8, 3.1, 0xe07020), // orange HV cable
        ]), painted),
        instanced(shellGeometry(METRO.front, SIDE_A_R, SIDE_A_L, FRONT, JOINT), metroMat),
        instanced(mergeGeometries(headlights(fx, 1.6)), lights),
      ] },
      { from: METRO.front, to: METRO.front + METRO.bellows, meshes: [
        instanced(mergeGeometries([
          roundedSlab(METRO.bellows, 2.45, 2.62, 0.36, 0, 1.71, 0x80878e),
          ...Array.from({ length: 7 }, (_, k) => roundedSlab(0.06, 2.5, 2.66, 0.38, -METRO.bellows / 2 + 0.12 + k * 0.22, 1.71, 0x5b6269)), // folds
          box(METRO.bellows + 0.4, 0.6, 0.12, 0, 0, 3.12, 0x15171a).toNonIndexed(), // cable bundle; RoundedBox output is non-indexed
        ]), painted),
      ] },
      { from: METRO.front + METRO.bellows, to: M_TOTAL, meshes: [
        instanced(mergeGeometries([chassis(METRO.rear), ...axle(toRear(rearAxle)), ...acUnit(1.6, 2.2), ...batteries(-2.4), ...batteries(-1.3)]), painted),
        instanced(shellGeometry(METRO.rear, SIDE_B_R, SIDE_B_L, JOINT, REAR), metroMat),
        instanced(mergeGeometries(tailLights(rx)), lights),
      ] },
    ],
  };

  // --- standard (solo) ---
  const standardTex = atlas((ctx) => {
    paintSide(ctx, SIDE_A_R, 0, S_LEN, "right", standardLivery);
    paintSide(ctx, SIDE_A_L, 0, S_LEN, "left", standardLivery);
    paintFront(ctx, FRONT, "SWO Mobil", "SWO Mobil");
    paintRear(ctx, REAR, WHITE);
  });
  const sx = S_LEN / 2, toSolo = (g: number) => g - sx;
  const standard: BusModel = {
    count: 0, tagAt: S_LEN / 2,
    sections: [{ from: 0, to: S_LEN, meshes: [
      instanced(mergeGeometries([
        chassis(S_LEN), ...standardLivery.axles.flatMap((g) => axle(toSolo(g))),
        ...acUnit(0.8, 2.4), ...batteries(-2.6), ...batteries(-3.7), ...batteries(-1.5),
        box(1.4, 0.07, 0.12, 4.4, -0.35, 3.13, 0x111111), box(1.4, 0.07, 0.12, 4.4, 0.35, 3.13, 0x111111), // charging rails
      ]), painted),
      instanced(shellGeometry(S_LEN, SIDE_A_R, SIDE_A_L, FRONT, REAR), liveryMaterial(standardTex)),
      instanced(mergeGeometries([...headlights(sx, 1.6), ...tailLights(sx)]), lights),
    ] }],
  };

  const meshes = [metro, standard].flatMap((m) => m.sections.flatMap((s) => s.meshes));
  return { metro, standard, meshes, textures: [metroTex, standardTex] };
}
