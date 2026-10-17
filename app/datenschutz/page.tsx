import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Datenschutz – Osnabrück Busradar" };

const link = "underline underline-offset-2 hover:text-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function Datenschutz() {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 text-sm leading-relaxed text-muted-foreground">
      <div className="grid gap-4">
        <Button variant="ghost" size="sm" className="w-fit" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft /> Zurück zur Karte
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">Datenschutz</h1>
        <p>
          Das Osnabrück Busradar kommt ohne Cookies, ohne Tracking und ohne Nutzerkonto aus. Hier steht, welche Daten
          trotzdem anfallen, wenn du die Seite benutzt, und welche Rechte du hast.
        </p>
      </div>

      <Section title="Verantwortlich">
        <p>
          Luis Wagener, E-Mail: <a href="mailto:info@luiswagener.de" className={link}>info@luiswagener.de</a>. Die
          vollständige Anschrift findest du im <Link href="/impressum" target="_blank" className={link}>Impressum</Link>.
        </p>
      </Section>

      <Section title="Aufruf der Seite">
        <p>
          Die Seite wird bei Railway gehostet (Railway Corporation, 548 Market St PMB 68956, San Francisco, CA 94104,
          USA). Der Server steht in einem Rechenzentrum in Amsterdam (Niederlande). Wenn du die Seite öffnest, verarbeitet Railway technisch notwendige Daten: deine IP-Adresse, Datum und
          Uhrzeit, die aufgerufene Adresse und Angaben zu deinem Browser. Das ist nötig, um die Seite auszuliefern und
          sicher zu betreiben (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO). Wie lange diese Protokolle
          aufbewahrt werden, legt Railway fest.
        </p>
        <p>
          Weil Railway ein US-Unternehmen ist, können Daten wie diese Protokolle auch in den USA verarbeitet werden.
          Dafür ist ein Vertrag zur Auftragsverarbeitung mit EU-Standardvertragsklauseln geschlossen (Art. 28 und
          Art. 46 DSGVO). Mehr dazu in
          der <a href="https://railway.com/legal/privacy" target="_blank" rel="noreferrer" className={link}>Datenschutzerklärung von Railway</a>.
        </p>
      </Section>

      <Section title="Karte">
        <p>
          Die Kartenkacheln, der Kartenstil und die Schrift auf der Karte werden direkt von{" "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className={link}>OpenFreeMap</a> geladen.
          Dabei erhält OpenFreeMap deine IP-Adresse, weil dein Browser die Daten dort abruft. Ohne diese Daten kann die
          Karte nicht angezeigt werden (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO). Was OpenFreeMap mit diesen
          Daten macht, steht in den Datenschutzhinweisen von OpenFreeMap.
        </p>
      </Section>

      <Section title="Live-Daten der Busse">
        <p>
          Die Fahrplan- und Echtzeitdaten holt der Server dieser Seite bei{" "}
          <a href="https://transitous.org" target="_blank" rel="noreferrer" className={link}>Transitous</a>. Dabei werden
          keine Daten über dich weitergegeben, sondern nur der Kartenausschnitt Osnabrück und die Uhrzeit.
        </p>
      </Section>

      <Section title="Schriftarten, Cookies und Tracking">
        <p>
          Die Schriftarten der Seite werden von diesem Server ausgeliefert, nicht von Google oder anderen Anbietern.
          Es werden keine Cookies gesetzt und keine Daten auf deinem Gerät gespeichert. Es gibt keine Analyse- oder
          Werbedienste. Deshalb brauchst du auch nichts zu bestätigen.
        </p>
      </Section>

      <Section title="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner Daten sowie
          das Recht, der Verarbeitung zu widersprechen (Art. 15 bis 21 DSGVO). Schreib dazu einfach an{" "}
          <a href="mailto:info@luiswagener.de" className={link}>info@luiswagener.de</a>. Außerdem kannst du dich bei
          einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für den Datenschutz
          Niedersachsen.
        </p>
      </Section>

      <p className="text-xs">Stand: Oktober 2026</p>
    </main>
  );
}
