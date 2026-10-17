// Client-only map engine: bus positions, instanced 3D models, map tags. Runs per frame, so it lives outside React.
import * as THREE from "three";
import type { CustomLayerInterface, LngLat, Map as MlMap, Marker } from "maplibre-gl";
import { cn } from "@/lib/utils";
import { createBusModels, type BusModel } from "@/lib/bus-models";
import type { LiveData, LiveSegment } from "@/lib/types";

type Maplibre = typeof import("maplibre-gl");

export const shortName = (n: string) => n.replace(/^Osnabrück[,\s]+/, "");

// shortcut: hashed hues, not the official VOS colors (the API doesn't provide them).
// Golden-angle steps keep names that differ by one character (14, 15, 16) far apart.
export const lineColor = (name: string) =>
  `hsl(${Math.round(([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) * 137.508) % 360)}, 80%, 62%)`;

export function decodePolyline(str: string, precision = 5): [number, number][] {
  const out: [number, number][] = [], f = 10 ** precision;
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (let k = 0; k < 2; k++) {
      let r = 0, sh = 0, c;
      do { c = str.charCodeAt(i++) - 63; r |= (c & 31) << sh; sh += 5; } while (c >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (k) lon += d; else lat += d;
    }
    out.push([lat / f, lon / f]);
  }
  return out;
}
console.assert(JSON.stringify(decodePolyline("_p~iF~ps|U_ulLnnqC")) === "[[38.5,-120.2],[40.7,-120.95]]", "polyline decoder broken");

type Segment = { from: string; to: string; dep: number; arr: number; schedArr: number; pts: [number, number][]; cum: number[] };
// stop/time: where the bus waits (atStop) or the stop it is driving to
type Located = { seg: Segment; i: number; dist: number; atStop: boolean; stop: string; time: number; x: number; y: number; heading: number | null };
export type Bus = {
  id: string; line: string; rt: boolean; css: string; segs: Segment[];
  heading: number | null; state?: Located; ll?: LngLat; el: HTMLButtonElement; tag: HTMLSpanElement; marker: Marker;
};

export const delayOf = (b: Bus) => (b.state ? Math.round((b.state.seg.arr - b.state.seg.schedArr) / 60000) : 0);
export const delayText = (d: number) => (d > 0 ? `+${d} min` : d < 0 ? `${d} min` : "pünktlich");

function pointAt(seg: Segment, dist: number) {
  const { pts, cum } = seg;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= dist) lo = mid; else hi = mid; }
  const a = pts[lo], b = pts[hi], len = cum[hi] - cum[lo];
  const f = len ? Math.min(1, Math.max(0, (dist - cum[lo]) / len)) : 0;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, heading: len ? Math.atan2(b[1] - a[1], b[0] - a[0]) : null };
}

// where is the bus now: on the segment that is running, or waiting at the end of the last finished one
function locate(b: Bus, now: number): Located {
  let i = 0, f = 0;
  for (let k = 0; k < b.segs.length; k++) {
    const s = b.segs[k];
    if (now < s.dep) break;
    i = k; f = s.arr > s.dep ? Math.min(1, (now - s.dep) / (s.arr - s.dep)) : 1;
    if (f < 1) break;
  }
  const seg = b.segs[i];
  const eased = f * f * (3 - 2 * f); // accelerate away, brake into the stop
  const waitingAtStart = f === 0, dist = eased * seg.cum.at(-1)!;
  return {
    seg, i, dist, atStop: f === 0 || f === 1,
    stop: waitingAtStart ? seg.from : seg.to, time: waitingAtStart ? seg.dep : seg.arr,
    ...pointAt(seg, dist),
  };
}
{
  // A→B (0–100 s, 100 m east), B→C (zero duration at 160 s, 50 m north), C→D (200–300 s)
  const seg = (from: string, to: string, dep: number, arr: number, pts: [number, number][]): Segment =>
    ({ from, to, dep, arr, schedArr: arr, pts, cum: [0, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])] });
  const bus = { segs: [seg("A", "B", 0, 100, [[0, 0], [100, 0]]), seg("B", "C", 160, 160, [[100, 0], [100, 50]]), seg("C", "D", 200, 300, [[100, 50], [0, 50]])] } as unknown as Bus;
  const at = (now: number) => { const l = locate(bus, now); return `${l.stop} ${l.atStop} ${Math.round(l.x)},${Math.round(l.y)}`; };
  console.assert(
    [-10, 50, 130, 160, 999].map(at).join("|") === "A true 0,0|B false 50,0|B true 100,0|C true 100,50|D true 0,50",
    "bus locator broken",
  );
}

// point `dist` meters along segment i; negative distances walk back into earlier segments,
// and beyond the first known one we extend straight backwards (articulated buses need ~18 m of trail).
// The direction is averaged over 25 m: polylines start with a short sideways stub from the platform to the road.
function sample(b: Bus, i: number, dist: number) {
  while (dist < 0 && i > 0) dist += b.segs[--i].cum.at(-1)!;
  const seg = b.segs[i];
  if (dist >= 0) return pointAt(seg, dist);
  const p0 = pointAt(seg, 0), p1 = pointAt(seg, Math.min(25, seg.cum.at(-1)!));
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const dx = len ? (p1.x - p0.x) / len : Math.cos(b.heading ?? 0), dy = len ? (p1.y - p0.y) / len : Math.sin(b.heading ?? 0);
  return { x: p0.x + dx * dist, y: p0.y + dy * dist, heading: null };
}

const isMetroBus = (line: string) => /^M[1-5]$/.test(line);

const MAX_BUSES = 400; // per model

const TAG = "block cursor-pointer rounded-md border-2 border-black/30 bg-(--c) px-1.5 py-1 text-xs leading-none font-extrabold whitespace-nowrap text-black shadow-md";
const TAG_SELECTED = "border-white px-2.5 py-1.5 text-sm";

export function createRadar(ml: Maplibre, map: MlMap, onPick: (id: string) => void) {
  // local metric frame around the city avoids float32 jitter of raw mercator coordinates
  const origin = ml.MercatorCoordinate.fromLngLat([8.047, 52.275]);
  const unit = origin.meterInMercatorCoordinateUnits();
  const toLocal = ([lat, lon]: [number, number]): [number, number] => {
    const m = ml.MercatorCoordinate.fromLngLat([lon, lat]);
    return [(m.x - origin.x) / unit, -(m.y - origin.y) / unit]; // x east, y north, meters
  };
  const toLngLat = ([x, y]: [number, number]) => new ml.MercatorCoordinate(origin.x + x * unit, origin.y - y * unit, 0).toLngLat();

  const buses = new Map<string, Bus>();
  let activeLine: string | null = null, selectedId: string | null = null;

  function makeSegment([from, to, dep, arr, schedArr, poly]: LiveSegment): Segment {
    const pts = decodePolyline(poly).map(toLocal);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { from: shortName(from), to: shortName(to), dep, arr, schedArr, pts, cum };
  }

  function refreshTags() {
    for (const b of buses.values()) {
      const sel = b.id === selectedId;
      // style the inner span: the marker element itself carries maplibre's positioning classes
      b.tag.className = cn(TAG, sel && TAG_SELECTED);
      b.tag.textContent = b.line + (sel && b.rt ? `  ${delayText(delayOf(b))}` : "");
      b.el.style.zIndex = sel ? "10" : "";
    }
  }

  function ingest(data: LiveData) {
    const seen = new Set<string>();
    for (const t of data.trips) {
      seen.add(t.id);
      let b = buses.get(t.id);
      if (!b) {
        const el = document.createElement("button");
        const tag = el.appendChild(document.createElement("span"));
        el.setAttribute("aria-label", `Linie ${t.line}`);
        el.addEventListener("click", (e) => { e.stopPropagation(); onPick(t.id); });
        const marker = new ml.Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat([0, 0]).addTo(map);
        b = { id: t.id, line: t.line, rt: t.rt, css: "", segs: [], heading: null, el, tag, marker };
        buses.set(t.id, b);
      }
      b.line = t.line; b.rt = t.rt;
      b.css = lineColor(t.line);
      b.el.style.setProperty("--c", b.css);
      b.segs = t.segs.map(makeSegment).filter((s) => s.pts.length);
    }
    for (const [id, b] of buses) if (!seen.has(id)) { b.marker.remove(); buses.delete(id); }
    refreshTags();
  }

  const models = createBusModels(MAX_BUSES);
  const modelFor = (b: Bus): BusModel => (isMetroBus(b.line) ? models.metro : models.standard);
  const dummy = new THREE.Object3D();
  type P = { x: number; y: number };
  function pose(list: THREE.InstancedMesh[], i: number, from: P, to: P, scale: number, fallback: number) {
    const dx = to.x - from.x, dy = to.y - from.y; // a rigid section spans from its rear point to its front point
    dummy.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
    dummy.rotation.set(0, 0, dx || dy ? Math.atan2(dy, dx) : fallback);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    for (const m of list) m.setMatrixAt(i, dummy.matrix);
  }

  function update() {
    const now = Date.now();
    const boost = Math.min(12, Math.max(1, 2 ** (17.5 - map.getZoom()))); // keep buses readable when zoomed out
    models.metro.count = models.standard.count = 0;
    for (const b of buses.values()) {
      const model = modelFor(b);
      const show = (!activeLine || b.line === activeLine) && b.segs.length > 0;
      b.el.style.display = show ? "" : "none";
      if (!show || model.count >= MAX_BUSES) continue;
      const p = (b.state = locate(b, now));
      if (b.heading === null) b.heading = p.heading ?? 0;
      if (p.heading !== null && !p.atStop) { let dh = p.heading - b.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); b.heading += dh * 0.12; }
      // every section follows the road on its own, so articulated buses bend in curves
      const at = (back: number) => sample(b, p.i, p.dist - back * boost);
      const i = model.count++;
      for (const s of model.sections) pose(s.meshes, i, at(s.to), at(s.from), boost, b.heading);
      const tag = at(model.tagAt);
      b.ll = toLngLat([tag.x, tag.y]);
      b.marker.setLngLat(b.ll);
    }
    for (const model of [models.metro, models.standard]) {
      for (const s of model.sections) for (const m of s.meshes) { m.count = model.count; m.instanceMatrix.needsUpdate = true; }
    }
  }

  let camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer;
  // map matrix · translate(origin) · scale(meters → mercator, y flipped so +y is north)
  const base = new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0).scale(new THREE.Vector3(unit, -unit, unit));
  const layer: CustomLayerInterface = {
    id: "buses", type: "custom", renderingMode: "3d",
    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0x8899bb, 1.5), ...models.meshes);
      const sun = new THREE.DirectionalLight(0xffe2b8, 2.2); sun.position.set(-60, -100, 150); scene.add(sun);
      const fill = new THREE.DirectionalLight(0x6688ff, 0.8); fill.position.set(80, 60, 60); scene.add(fill);
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      for (const t of models.textures) t.anisotropy = renderer.capabilities.getMaxAnisotropy(); // livery stays sharp at flat angles
    },
    render(_gl, args) {
      update();
      camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(base);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };

  return {
    buses, ingest, layer, refreshTags,
    setFilter(line: string | null) { activeLine = line; },
    setSelected(id: string | null) { selectedId = id; refreshTags(); },
  };
}

export type Radar = ReturnType<typeof createRadar>;
