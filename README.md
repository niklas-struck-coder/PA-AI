# Dein eigenes "Lina & Team" - kostenlos, kein Programmieren nötig

Eine kleine Web-App: eine persönliche Assistentin plus drei "Kollegen"
(IT-Chef, Marketing-Chef, Support-Chef), als Chat oder Sprachanruf. Du
kannst alle vier komplett umbenennen und ihnen in den Einstellungen eine
eigene Persönlichkeit in eigenen Worten geben - ohne eine Zeile Code.

Läuft komplett kostenlos auf GitHub Pages (Website) + Cloudflare Worker
(Verbindung zur KI). Dauer der Einrichtung: ca. 15 Minuten, einmalig.

## Teil 1: Cloudflare Worker (die "Verbindung" zur KI)

1. Gehe auf [dash.cloudflare.com](https://dash.cloudflare.com) und erstelle ein kostenloses Konto.
2. **Workers & Pages** → **Create** → Reiter **Workers** → Vorlage **"Hello World"** → Namen vergeben (z. B. `lina-proxy`) → **Deploy** (erstmal mit dem Standard-Code).
3. **Edit code** → kompletten Beispielcode löschen → Inhalt von `worker/worker.js` (aus diesem Ordner) einfügen → **Deploy**.
4. Kostenlosen Groq-Key holen: [console.groq.com/keys](https://console.groq.com/keys) → Konto anlegen → **Create API Key**. Keine Kreditkarte nötig.
5. Im Worker unter **Settings → Variables and Secrets** eine Variable hinzufügen:
   - Name: `GROQ_API_KEY`, Wert: dein Key, Typ: **Secret**
6. Optional, aber empfohlen - Zugangscode, damit nicht jeder mit dem Link chatten kann:
   - Name: `ACCESS_CODE`, Wert: ein Code deiner Wahl, Typ: **Secret**
7. Deine Worker-URL steht oben auf der Worker-Übersichtsseite, z. B. `https://lina-proxy.dein-name.workers.dev` - die brauchst du gleich.

## Teil 2: Website auf GitHub Pages

1. [github.com](https://github.com) → **New repository** → Name frei wählbar (z. B. `mein-team`), Sichtbarkeit **Public**, "Add a README" NICHT anhaken.
2. **Add file → Upload files** → lade `index.html`, `manifest.json`, `icon-192.png`, `icon-512.png` aus diesem Ordner hoch (den `worker`-Unterordner NICHT mit hochladen, der bleibt privat/lokal). Commit auf `main`.
3. **Settings → Pages** → Branch `main`, Ordner `/ (root)` → **Save**.
4. Nach ca. 1 Minute live unter `https://<dein-github-name>.github.io/<repo-name>/`.

## Teil 3: Erste Öffnung - Lina führt dich durch den Rest

Öffne die Seite. Als Allererstes fragt sie: **Deutsch oder English?** - die
komplette Oberfläche und die KI-Antworten laufen danach in der gewählten
Sprache (jederzeit in den Einstellungen änderbar). Danach fragt sie nach
deiner Worker-URL aus Teil 1 (und dem Zugangscode, falls du einen
eingerichtet hast) - das trägst du direkt in der Seite ein, kein
Code-Editor nötig. Danach bist du fertig und kannst chatten.

## Alles Weitere geht in den Einstellungen (⚙️), ohne Programmieren

- **Sprache**: Deutsch oder English, jederzeit umschaltbar - wirkt auf die
  komplette Oberfläche und auf die Sprache, in der die KI antwortet
  (Standard-Persönlichkeiten sind für beide Sprachen vorbereitet).
- **Namen & Profilbilder** der vier Personen ändern.
- **Persönlichkeit**: eigenes Textfeld pro Person - schreib einfach in
  eigenen Worten, wer diese Person ist und worauf sie sich fokussiert, z.B.
  *"Du bist Finn, mein Trainingspartner. Fokus: Fitness, Ernährung,
  Motivation. Ton: locker, motivierend, per du."* Das wird direkt an die KI
  geschickt, keine Einschränkung außer der Länge.
- **Sprachausgabe**: Englisch (klingt natürlicher, spricht deutschen Text
  mit englischem Akzent) oder Deutsch (Browser-Stimme, robotischer aber
  korrekte Aussprache).
- **Worker-URL ändern**: falls du mal umziehst oder einen neuen Worker
  anlegst.

## Optional: eigenen Kalender verbinden (nur lesend)

Funktioniert über einen inoffiziellen Reclaim.ai-Endpunkt (kostenlos,
aber undokumentiert - kann jederzeit aufhören zu funktionieren, dann läuft
der Chat einfach ohne Kalenderkontext weiter):

1. [app.reclaim.ai/settings/developer](https://app.reclaim.ai/settings/developer) → API-Key erstellen.
2. Im Cloudflare-Worker unter **Settings → Variables and Secrets**:
   - Name: `RECLAIM_API_KEY`, Wert: der Key, Typ: **Secret**
3. Fertig - nur lesend, keine Termine werden angelegt oder verändert.

## Was NICHT enthalten ist (bewusst)

- **Keine Kalender-Schreibrechte** - aus Sicherheitsgründen absichtlich nicht gebaut.
- **Keine "echten" Cloud-Agenten**, die im Hintergrund für dich arbeiten (die
  Vorschau-Berichte, die IT-Chef/Marketing-Chef/Support-Chef ggf. lesen
  können, sind optional und müssten separat über eigene Automatisierung
  befüllt werden - `REPORT_URL_IT`/`REPORT_URL_MARKETING`/`REPORT_URL_SUPPORT`
  bzw. `PROJECT_STATUS_URL` als Variable im Worker, falls du sowas selbst
  aufsetzen willst). Ohne diese Variablen läuft alles normal, nur ohne
  diesen Zusatzkontext.
- Diese Web-Version hat keinen Speicher/keine Werkzeuge wie ein "echter"
  KI-Agent - es ist ein einfacher, aber funktionierender Chat mit echten
  KI-Antworten (Groq) und gesprochener Stimme.

## Kosten

Alles in den kostenlosen Kontingenten: Cloudflare Worker, GitHub Pages und
Groq (14.400 Anfragen/Tag) sind für normale Nutzung dauerhaft kostenlos,
keine Kreditkarte nötig.
