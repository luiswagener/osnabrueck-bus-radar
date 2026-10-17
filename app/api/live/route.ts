import { connection } from "next/server";
import { getLive } from "@/lib/transitous";

export async function GET() {
  await connection(); // live data: always answer at request time, never prerender
  try {
    return Response.json(await getLive(), { headers: { "Cache-Control": "public, max-age=10" } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
