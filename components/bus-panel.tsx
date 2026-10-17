"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type Ref } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AUTHOR, AboutDialog } from "@/components/about-dialog";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { delayOf, delayText, lineColor, shortName, type Bus } from "@/lib/radar";
import type { TripDetail } from "@/lib/types";

const fmt = (ms: number) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const colorVar = (line: string) => ({ "--c": lineColor(line) }) as CSSProperties;

function LineBadge({ line }: { line: string }) {
  return <Badge style={colorVar(line)} className="bg-(--c) font-bold text-black">{line}</Badge>;
}

function DelayBadge({ bus }: { bus: Bus }) {
  if (!bus.rt) return <Badge variant="secondary">Fahrplan</Badge>;
  const d = delayOf(bus);
  return (
    <Badge
      variant={d >= 5 ? "destructive" : "secondary"}
      className={cn(d < 2 && "bg-emerald-500/15 text-emerald-400", d >= 2 && d < 5 && "bg-orange-500/15 text-orange-400")}
    >
      {delayText(d)}
    </Badge>
  );
}

type Props = {
  sheetRef?: Ref<HTMLDivElement>; // lets the map measure how much of it the mobile sheet covers
  now: number;
  buses: Bus[];
  selected: Bus | null;
  detail: TripDetail | null;
  activeLine: string | null;
  error: string | null;
  onLine: (line: string | null) => void;
  onSelect: (id: string | null) => void;
};

export function BusPanel({ sheetRef, now, buses, selected, detail, activeLine, error, onLine, onSelect }: Props) {
  const perLine = new Map<string, number>();
  for (const b of buses) perLine.set(b.line, (perLine.get(b.line) ?? 0) + 1);
  const lines = [...perLine.keys()].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
  const visible = buses.filter((b) => !activeLine || b.line === activeLine);
  const live = visible.filter((b) => b.rt);

  // Mobile bottom sheet. The whole top area (handle, title, status) is the grip: tap toggles, a flick decides by
  // its direction, a slow drag snaps to the nearer position. On desktop (md+) the card is a fixed sidebar.
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState<{ dy: number; travel: number } | null>(null); // travel: px between open and collapsed
  const gesture = useRef({ y0: 0, y: 0, t: 0, v: 0 }); // finger start, last sample, velocity in px/ms
  const [shownId, setShownId] = useState(selected?.id);
  if (selected?.id !== shownId) { // picking a bus opens the sheet so its details are visible
    setShownId(selected?.id);
    if (selected) setCollapsed(false);
  }
  const PEEK_REM = 5.6; // handle + title + status line stay visible when collapsed (matches the class below)
  const offsetOf = (d: { dy: number; travel: number }) => Math.min(d.travel, Math.max(0, (collapsed ? d.travel : 0) + d.dy));
  // `translate` (not `transform`): Tailwind v4's translate-y-* uses the translate property, so this replaces it instead of adding up
  const dragStyle: CSSProperties | undefined = drag ? { transition: "none", translate: `0 ${offsetOf(drag)}px` } : undefined;

  const onGripDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const sheet = e.currentTarget.closest<HTMLElement>("[data-slot=card]")!;
    const peek = PEEK_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
    gesture.current = { y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0 };
    setDrag({ dy: 0, travel: Math.max(0, sheet.offsetHeight - peek) });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const g = gesture.current, dt = e.timeStamp - g.t;
    if (dt > 0) g.v = 0.7 * ((e.clientY - g.y) / dt) + 0.3 * g.v; // smoothed so one jittery sample can't decide
    g.y = e.clientY; g.t = e.timeStamp;
    setDrag({ ...drag, dy: e.clientY - g.y0 });
  };
  const onGripUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const v = e.timeStamp - gesture.current.t > 80 ? 0 : gesture.current.v; // finger rested before release: no flick
    if (Math.abs(drag.dy) < 6) setCollapsed(!collapsed);   // tap
    else if (Math.abs(v) > 0.35) setCollapsed(v > 0);      // flick
    else setCollapsed(offsetOf(drag) > drag.travel / 2);   // slow drag: nearer position
    setDrag(null);
  };

  return (
    <Card
      ref={sheetRef}
      style={dragStyle}
      className={cn(
        "fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] gap-0 rounded-t-3xl rounded-b-none py-0 shadow-2xl transition-transform duration-300 ease-out",
        "md:inset-y-0 md:right-auto md:left-0 md:max-h-none md:w-96 md:translate-y-0 md:rounded-none",
        collapsed && "translate-y-[calc(100%-5.6rem)]",
      )}
    >
      <div
        className="shrink-0 touch-none select-none max-md:cursor-grab max-md:active:cursor-grabbing md:touch-auto md:select-auto"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={() => setDrag(null)}
      >
        <button
          type="button"
          aria-label={collapsed ? "Panel aufklappen" : "Panel einklappen"}
          aria-expanded={!collapsed}
          className="flex h-7 w-full items-center justify-center md:hidden"
          onClick={(e) => { if (e.detail === 0) setCollapsed(!collapsed); }} // keyboard only, pointer taps are handled by the grip
        >
          <span className="h-1.5 w-10 rounded-lg bg-muted-foreground/40" />
        </button>
        <CardHeader className="pb-3 md:pt-5">
          <CardTitle className="text-lg font-semibold"><h1>Osnabrück Busradar</h1></CardTitle>
          <CardDescription className={cn(error && "text-destructive")}>
            {error
              ? `Keine Live-Daten (${error}) – neuer Versuch in 15 s`
              : now
                ? `${visible.length} Busse unterwegs · ${live.length} mit Echtzeit · Stand ${fmt(now)}`
                : "Lade Live-Daten …"}
          </CardDescription>
        </CardHeader>
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
        <Select
          aria-label="Linie wählen"
          className="shrink-0"
          value={activeLine ?? "all"}
          onValueChange={(v) => onLine(v === "all" ? null : v)}
          options={[
            { value: "all", label: `Alle Linien (${buses.length} Busse)` },
            ...lines.map((l) => ({ value: l, label: `Linie ${l} (${perLine.get(l)} ${perLine.get(l) === 1 ? "Bus" : "Busse"})` })),
          ]}
        />

        {selected ? <Selected bus={selected} detail={detail} now={now} onClose={() => onSelect(null)} /> : <Overview live={live} onSelect={onSelect} />}
      </CardContent>

      <CardFooter className="shrink-0 justify-between gap-2 rounded-b-none px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
        <span>
          Ein Projekt von{" "}
          <a href={AUTHOR.href} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">{AUTHOR.name}</a>
        </span>
        {/* OSM attribution guidelines: the credit must be visible next to the map, details may sit behind an "About" */}
        <AboutDialog trigger={<Button variant="ghost" size="xs" />}>© OpenStreetMap & Quellen</AboutDialog>
      </CardFooter>
    </Card>
  );
}

function Selected({ bus, detail, now, onClose }: { bus: Bus; detail: TripDetail | null; now: number; onClose: () => void }) {
  const st = bus.state;
  const upcoming = (detail?.stops ?? []).filter((s) => s.arr >= now - 30e3).slice(0, 5);
  return (
    <Card size="sm" className="bg-muted/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineBadge line={bus.line} />
          <span className="font-semibold">{detail ? `→ ${shortName(detail.stops.at(-1)!.name)}` : "Lade Fahrt …"}</span>
        </CardTitle>
        <CardDescription>
          {st && <>{st.atStop ? "Hält an" : "Nächster Halt"}: <b className="text-foreground">{st.stop}</b> · {fmt(st.time)}</>}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <DelayBadge bus={bus} />
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Auswahl schließen"><X /></Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1.5">
          {upcoming.map((s) => (
            <li key={s.name + s.sched} className="flex justify-between gap-3">
              <span>{shortName(s.name)}</span>
              <span className="tabular-nums">
                {fmt(s.arr) !== fmt(s.sched) && <s className="mr-1.5 text-muted-foreground">{fmt(s.sched)}</s>}
                {fmt(s.arr)}
              </span>
            </li>
          ))}
        </ul>
        {detail?.agency && <p className="mt-2 text-xs text-muted-foreground">{detail.agency}</p>}
      </CardContent>
    </Card>
  );
}

// fun overview: most delayed bus + punctuality right now
function Overview({ live, onSelect }: { live: Bus[]; onSelect: (id: string) => void }) {
  const shame = live.reduce<Bus | null>((m, b) => (!m || delayOf(b) > delayOf(m) ? b : m), null);
  const punctual = live.filter((b) => delayOf(b) < 3).length;
  if (!live.length) {
    return (
      <Card size="sm" className="bg-muted/40">
        <CardHeader>
          <CardTitle>Keine Echtzeitdaten</CardTitle>
          <CardDescription>Für diese Busse gibt es gerade nur den Fahrplan.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
      {shame && delayOf(shame) >= 2 ? (
        <Card size="sm" className="bg-muted/40">
          <CardHeader>
            <CardTitle>🐌 Bus der Schande</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <LineBadge line={shame.line} /> <DelayBadge bus={shame} /> Richtung {shame.state?.seg.to}
            </CardDescription>
            <CardAction><Button size="sm" onClick={() => onSelect(shame.id)}>Verfolgen</Button></CardAction>
          </CardHeader>
        </Card>
      ) : (
        <Card size="sm" className="bg-muted/40">
          <CardHeader>
            <CardTitle>🎉 Alle pünktlich!</CardTitle>
            <CardDescription>Kein Bus mehr als 1 min zu spät.</CardDescription>
          </CardHeader>
        </Card>
      )}
      <Card size="sm" className="bg-muted/40">
        <CardHeader>
          <CardTitle>⏱ Pünktlich gerade (&lt; 3 min)</CardTitle>
          <CardDescription>Tippe auf einen Bus auf der Karte für Details.</CardDescription>
          <CardAction className="text-lg font-bold tabular-nums">{Math.round((punctual / live.length) * 100)} %</CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
