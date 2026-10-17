// Shared between the API routes and the client.
export type LiveSegment = [from: string, to: string, dep: number, arr: number, schedArr: number, polyline: string];
export type LiveTrip = { id: string; line: string; rt: boolean; segs: LiveSegment[] };
export type LiveData = { trips: LiveTrip[] };

export type TripStop = { name: string; lat: number; lon: number; arr: number; sched: number };
export type TripDetail = { id: string; agency?: string; stops: TripStop[]; geometry?: { points: string; precision?: number } };
