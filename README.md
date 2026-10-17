# Osnabrück Busradar

Wo ist mein Bus gerade? Das Osnabrück Busradar zeigt alle Busse in Osnabrück live auf einer 3D-Karte, samt Verspätung und den nächsten Haltestellen.

## Was du damit machen kannst

- **Alle Busse auf einen Blick:** Jeder Bus fährt als kleines 3D-Modell über die Karte, so wie er gerade unterwegs ist.
- **Einen Bus verfolgen:** Tippe auf einen Bus. Die Karte fliegt hin und fährt mit. Du siehst, wohin er fährt, wann er an den nächsten Haltestellen ist und ob er pünktlich ist.
- **Nach Linie filtern:** Wähle eine Linie aus und sieh nur deren Busse.
- **Wie pünktlich ist Osnabrück gerade?** Die Übersicht zeigt, wie viele Busse gerade pünktlich sind, und den „Bus der Schande“, also den Bus mit der größten Verspätung.

Die MetroBus-Linien M1 bis M5 fahren als grüne Gelenkbusse über die Karte, alle anderen Linien als rot-weiße Stadtbusse, angelehnt an die echten Fahrzeuge.

Auf dem Computer liegt die Übersicht in einer Seitenleiste, auf dem Handy in einem Fenster am unteren Rand, das du nach unten wegschieben kannst.

## Woher die Daten kommen

Die Abfahrtszeiten und Verspätungen sind echte Live-Daten aus dem Verkehrsverbund. Die meisten Stadtbuslinien melden ihre Position in Echtzeit. Bei einigen Regionallinien gibt es nur den Fahrplan, das ist in der App mit „Fahrplan“ gekennzeichnet.

- Live-Daten: [Transitous](https://transitous.org/sources/), Quelle VBN/Connect
- Karte: [OpenFreeMap](https://openfreemap.org), [© OpenMapTiles](https://www.openmaptiles.org/), [© OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright)

## Hinweis

Das Busradar ist ein inoffizielles Hobbyprojekt. Es stammt nicht von den Stadtwerken Osnabrück oder der VOS. Alle Angaben sind ohne Gewähr, denn Echtzeitdaten können fehlen oder abweichen. Für deine Fahrt verlass dich bitte auf die offiziellen Fahrplanauskünfte. Die Busmodelle sind den Originalen nachempfunden; Marken und Logos gehören ihren Inhabern.

## Selbst ausprobieren

Für alle, die das Projekt auf dem eigenen Rechner starten möchten:

```sh
npm install
npm run dev
```

Danach läuft das Busradar unter http://localhost:3000.

## Von

Ein Projekt von [Luis Wagener](https://www.luiswagener.de).

Der Code steht unter der MIT-Lizenz und darf frei verwendet und verändert werden.
