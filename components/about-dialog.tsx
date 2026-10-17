"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// required credits for live data and map (Transitous usage policy, OpenStreetMap/ODbL)
const SOURCES: [label: string, href: string][] = [
  ["Live-Daten: Transitous (VBN/Connect)", "https://transitous.org/sources/"],
  ["Karte: OpenFreeMap", "https://openfreemap.org"],
  ["© OpenMapTiles", "https://www.openmaptiles.org/"],
  ["© OpenStreetMap-Mitwirkende", "https://www.openstreetmap.org/copyright"],
];
const link = "underline underline-offset-2 hover:text-foreground";
export const AUTHOR = { name: "Luis Wagener", href: "https://www.luiswagener.de" };

// the dialog with sources and disclaimer; `trigger` is the button element that opens it
export function AboutDialog({ trigger, children }: { trigger: ReactElement; children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Osnabrück Busradar</DialogTitle>
          <DialogDescription>
            Inoffizielles Hobbyprojekt, nicht von den Stadtwerken Osnabrück oder der VOS. Alle Angaben ohne Gewähr:
            Echtzeitdaten können fehlen oder abweichen. Die Busmodelle sind den Originalen nachempfunden; Marken und
            Logos gehören ihren Inhabern.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 text-sm">
          <p className="font-medium">Quellen</p>
          <ul className="grid gap-1 text-muted-foreground">
            {SOURCES.map(([label, href]) => (
              <li key={href}><a href={href} target="_blank" rel="noreferrer" className={link}>{label}</a></li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Ein Projekt von{" "}
          <a href={AUTHOR.href} target="_blank" rel="noreferrer" className={`${link} font-medium text-foreground`}>{AUTHOR.name}</a>
        </p>
        <p className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/impressum" target="_blank" className={link}>Impressum</Link>
          <Link href="/datenschutz" className={link}>Datenschutz</Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
