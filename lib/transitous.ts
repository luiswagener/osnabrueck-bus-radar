import { cacheLife } from "next/cache";
import type { LiveData, LiveTrip, TripDetail } from "@/lib/types";

const API = "https://api.transitous.org/api";
const BBOX = { min: "52.34,7.93", max: "52.20,8.16" }; // Osnabrück + close surroundings
// The Transitous usage policy requires contact info in the User-Agent.
const UA = "osnabrueck-busradar/0.1 (info@luiswagener.de)";

type Place = { name: string; lat: number; lon: number; arrival?: string; departure?: string; scheduledArrival?: string; scheduledDeparture?: string };
type MapSegment = {
  mode: string; trips: { tripId: string; displayName: string }[]; from: Place; to: Place;
  departure: string; arrival: string; scheduledArrival: string; realTime: boolean; polyline: string;
};
type TripLeg = { tripId: string; agencyName?: string; from: Place; to: Place; intermediateStops?: Place[]; legGeometry?: TripDetail["geometry"] };

// Cached per (path, params): one upstream request per time window, shared by all viewers.
async function transitous<T>(path: string, params: Record<string, string>, seconds: number): Promise<T> {
  "use cache";
  cacheLife({ stale: seconds, revalidate: seconds, expire: seconds * 4 });
  const r = await fetch(`${API}${path}?${new URLSearchParams(params)}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Transitous ${r.status}`);
  return r.json();
}

// All bus segments (stop → stop) active from 30 s ago until 3 min ahead, grouped per trip.
export async function getLive(): Promise<LiveData> {
  const bucket = Math.floor(Date.now() / 15e3) * 15e3; // snap to 15 s so the URL (= cache key) is stable
  const iso = (ms: number) => new Date(ms).toISOString();
  const segments = await transitous<MapSegment[]>(
    "/v4/map/trips",
    { zoom: "18", ...BBOX, startTime: iso(bucket - 30e3), endTime: iso(bucket + 180e3) },
    15,
  );
  const trips = new Map<string, LiveTrip>();
  for (const s of segments) {
    if (s.mode !== "BUS") continue;
    const { tripId, displayName } = s.trips[0];
    let t = trips.get(tripId);
    if (!t) trips.set(tripId, (t = { id: tripId, line: displayName, rt: false, segs: [] }));
    t.rt ||= s.realTime;
    t.segs.push([s.from.name, s.to.name, Date.parse(s.departure), Date.parse(s.arrival), Date.parse(s.scheduledArrival), s.polyline]);
  }
  for (const t of trips.values()) t.segs.sort((a, b) => a[2] - b[2]);
  return { trips: [...trips.values()] };
}

export async function getTrip(id: string): Promise<TripDetail> {
  const d = await transitous<{ legs: TripLeg[] }>("/v5/trip", { tripId: id }, 30);
  // through-running buses (e.g. 392 → 19) come back as the linked trip; its stops and end point are still right
  const leg = d.legs.find((l) => l.tripId === id) ?? d.legs[0];
  const stop = (s: Place) => ({
    name: s.name, lat: s.lat, lon: s.lon,
    arr: Date.parse(s.arrival ?? s.departure ?? ""), sched: Date.parse(s.scheduledArrival ?? s.scheduledDeparture ?? ""),
  });
  return { id, agency: leg.agencyName, stops: [leg.from, ...(leg.intermediateStops ?? []), leg.to].map(stop), geometry: leg.legGeometry };
}
