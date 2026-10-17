import { connection } from "next/server";
import { getLive, getTrip } from "@/lib/transitous";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id || id.length > 200) return Response.json({ error: "bad id" }, { status: 400 });
  await connection(); // live data: always answer at request time, never prerender
  try {
    // only trips in the (cached) live data, so random ids never reach Transitous
    if (!(await getLive()).trips.some((t) => t.id === id)) return Response.json({ error: "unknown trip" }, { status: 404 });
    return Response.json(await getTrip(id), { headers: { "Cache-Control": "public, max-age=20" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
