"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";
import { Navigation, Navigation2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BusPanel } from "@/components/bus-panel";
import { MOBILE_BREAKPOINT } from "@/hooks/use-mobile";
import { createRadar, decodePolyline, shortName, type Bus, type Radar } from "@/lib/radar";
import type { LiveData, TripDetail } from "@/lib/types";

const POLL_MS = 15_000;

function addLayers(map: MlMap) {
  if (map.getLayer("building")) map.removeLayer("building");
  map.addLayer({
    id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 13,
    paint: {
      "fill-extrusion-color": "#2a2f38",
      "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
      "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
      "fill-extrusion-opacity": 0.9,
    },
  });
  map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("stops", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 12, "line-opacity": 0.2, "line-blur": 4 } });
  map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": ["get", "color"], "line-width": 4 } });
  map.addLayer({ id: "stops", type: "circle", source: "stops",
    paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 3 } });
  map.addLayer({ id: "stop-names", type: "symbol", source: "stops", minzoom: 14.5,
    layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.3], "text-anchor": "top", "text-font": ["Noto Sans Regular"] },
    paint: { "text-color": "#e8e8e8", "text-halo-color": "#000", "text-halo-width": 1.5 } });
}

function setRoute(map: MlMap | null, d: TripDetail | null, color: string) {
  const line = d?.geometry ? decodePolyline(d.geometry.points, d.geometry.precision ?? 5).map(([la, lo]) => [lo, la]) : [];
  (map?.getSource("route") as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: line.length ? [{ type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: line } }] : [],
  });
  (map?.getSource("stops") as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: (d?.stops ?? []).map((s) => ({
      type: "Feature", properties: { name: shortName(s.name), color }, geometry: { type: "Point", coordinates: [s.lon, s.lat] },
    })),
  });
}

export function BusRadar() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const radarRef = useRef<Radar | null>(null);
  const selRef = useRef<string | null>(null);
  const followRef = useRef({ on: false, fly: false });
  const sheetRef = useRef<HTMLDivElement>(null);
  // render snapshot: bus objects mutate every frame inside the radar, the panel only needs a slow tick
  const [snap, setSnap] = useState<{ now: number; buses: Bus[] }>({ now: 0, buses: [] });
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [following, setFollowingState] = useState(false);
  const [is3d, setIs3d] = useState(true);
  const [bearing, setBearing] = useState(-15);

  const setFollowing = useCallback((on: boolean, fly = false) => {
    followRef.current = { on, fly };
    setFollowingState(on);
  }, []);

  const select = useCallback((id: string | null) => {
    selRef.current = id;
    setSelectedId(id);
    setDetail(null);
    setFollowing(!!id, !!id);
    radarRef.current?.setSelected(id);
    setRoute(mapRef.current, null, "#fff");
  }, [setFollowing]);

  // map + radar setup and live polling (maplibre touches window, so it is imported on the client only)
  useEffect(() => {
    let map: MlMap | undefined, timer: number | undefined, cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      // the worker sits next to maplibre's own module by default, which the bundler moves; ship it as an asset instead
      ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      map = new ml.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [8.047, 52.275], zoom: 13.4, pitch: 55, bearing: -15, maxPitch: 75,
        attributionControl: false, // credited next to the map in the panel footer, details in components/about-dialog.tsx
      });
      mapRef.current = map;
      const radar = (radarRef.current = createRadar(ml, map, select));
      map.on("rotate", () => setBearing(map!.getBearing()));
      map.on("pitchend", () => setIs3d(map!.getPitch() > 5));
      map.on("dragstart", () => setFollowing(false));
      map.on("style.load", () => {
        addLayers(map!);
        map!.addLayer(radar.layer);
        const poll = async () => {
          if (document.hidden) return; // background tab: the next tick after returning catches up
          try {
            const r = await fetch("/api/live");
            if (!r.ok) throw new Error(`Server ${r.status}`);
            radar.ingest((await r.json()) as LiveData);
            setError(null);
            if (selRef.current && !radar.buses.has(selRef.current)) select(null);
            setSnap({ now: Date.now(), buses: [...radar.buses.values()] });
          } catch (e) {
            console.error(e);
            setError((e as Error).message);
          }
        };
        poll();
        timer = window.setInterval(poll, POLL_MS);
      });
    })();
    return () => { cancelled = true; clearInterval(timer); map?.remove(); };
  }, [select, setFollowing]);

  // panel + tag labels refresh (positions move every frame, text only needs a slow tick)
  useEffect(() => {
    const t = setInterval(() => {
      const radar = radarRef.current;
      if (!radar) return;
      radar.refreshTags();
      setSnap({ now: Date.now(), buses: [...radar.buses.values()] });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // trip details of the selected bus, refreshed with the live data
  useEffect(() => {
    if (!selectedId) return;
    let stale = false, first = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/trip?id=${encodeURIComponent(selectedId)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (stale) return;
        setDetail(d);
        if (first) setRoute(mapRef.current, d, radarRef.current?.buses.get(selectedId)?.css ?? "#fff");
        first = false;
      } catch (e) { console.error(e); }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { stale = true; clearInterval(t); };
  }, [selectedId]);

  // recenter once a second with a linear ease: smooth, and any user gesture simply interrupts it
  useEffect(() => {
    const t = setInterval(() => {
      const map = mapRef.current, f = followRef.current;
      const ll = selRef.current ? radarRef.current?.buses.get(selRef.current)?.ll : undefined;
      if (!map || !ll || !f.on || map.isMoving()) return;
      // on mobile the bottom sheet covers the lower map: center the bus in the visible part above it
      // (desktop: 0, the map already starts next to the sidebar)
      const sheet = sheetRef.current, mobile = window.innerWidth < MOBILE_BREAKPOINT;
      const covered = sheet && mobile ? Math.max(0, window.innerHeight - sheet.getBoundingClientRect().top) : 0;
      const padding = { top: 0, left: 0, right: 0, bottom: Math.min(covered, window.innerHeight * 0.8) };
      if (f.fly) { f.fly = false; map.flyTo({ center: ll, zoom: 17.8, pitch: 62, duration: 2000, padding }); }
      else map.easeTo({ center: ll, duration: 950, easing: (x) => x, padding });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const onLine = (line: string | null) => {
    setActiveLine(line);
    radarRef.current?.setFilter(line);
    if (line && selRef.current && radarRef.current?.buses.get(selRef.current)?.line !== line) select(null);
  };

  const selected = snap.buses.find((b) => b.id === selectedId) ?? null;

  return (
    <main className="fixed inset-0 bg-background">
      <div className="absolute inset-0 md:left-96">{/* leaves room for the desktop sidebar */}
        <div ref={container} className="size-full" />
      </div>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex flex-col items-end gap-2">
        <Button variant="secondary" size="icon-lg" className="rounded-lg font-semibold shadow-lg" aria-label="2D/3D umschalten"
          onClick={() => mapRef.current?.easeTo({ pitch: is3d ? 0 : 60, duration: 600 })}>
          {is3d ? "2D" : "3D"}
        </Button>
        <Button variant="secondary" size="icon-lg" className="rounded-lg shadow-lg" aria-label="Bus folgen" aria-pressed={following}
          disabled={!selectedId} onClick={() => setFollowing(!following, !following)}>
          <Navigation className={following ? "text-blue-500" : undefined} />
        </Button>
        <Button variant="secondary" size="icon-lg" className="rounded-lg shadow-lg" aria-label="Nach Norden ausrichten"
          onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 500 })}>
          <Navigation2 style={{ transform: `rotate(${-bearing}deg)` }} />
        </Button>
      </div>

      <BusPanel sheetRef={sheetRef} now={snap.now} buses={snap.buses} selected={selected} detail={detail} activeLine={activeLine} error={error} onLine={onLine} onSelect={select} />
    </main>
  );
}
