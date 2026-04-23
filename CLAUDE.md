# vokabelbox

Ein minimaler Vokabeltrainer für ein Kind (12 J.), das Spanisch lernt. PWA, optimiert fürs iPhone (Homescreen-Install).

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** für Styling (keine CSS-in-JS-Libs einführen)
- **Supabase** für Auth, Postgres, Storage
- **Anthropic SDK** (`@anthropic-ai/sdk`) für Vision-OCR der Buchfotos
- **lucide-react** für Icons
- Deploy auf **Vercel**, Repository auf **GitHub**

## Prinzipien

- **Keine neuen Libraries einführen**, ohne das zu begründen. Bevorzugt nativ + Tailwind.
- **Server Components by default**, Client Components nur wo nötig (`"use client"`).
- **Supabase-Zugriff immer mit RLS.** Niemals den `service_role` Key im Client/Browser, nur serverseitig in API-Routes oder Server Actions.
- **Anthropic-Calls ausschließlich serverseitig.** API-Key bleibt in `.env.local` / Vercel-Env.
- **Mobile first.** Jede Komponente wird primär auf iPhone-Viewport (~380px) designt. Touch-Targets mindestens 44×44px.
- **Deutsche UI-Sprache.**

## Code-Style

- TypeScript strikt, keine `any` ohne Kommentar-Begründung.
- Komponenten-Dateien: `PascalCase.tsx`. Utility/Hook-Dateien: `camelCase.ts`.
- Server-Actions und API-Routen validieren Eingaben mit Zod bei nicht-trivialem Input.
- Fehler sichtbar machen, nicht schlucken. User bekommt eine verständliche Fehlermeldung.

## Projektstruktur

```
app/
  (auth)/
    login/           # Magic Link Login
  (app)/
    page.tsx         # Home: Lektions-Übersicht
    lessons/
      new/           # Foto-Upload + Review
      [id]/          # Lektion-Detail
      [id]/learn/    # Lernmodus (Karteikarten)
      [id]/quiz/     # Abfrage mit Eingabe
      [id]/test/     # Test mit Benotung
  api/
    extract/         # POST: Bilder → Vokabelpaare (Anthropic Vision)
components/
  ui/                # Wiederverwendbare UI-Bausteine
  lesson/            # Lesson-spezifische Komponenten
lib/
  supabase/
    client.ts        # Browser-Client
    server.ts        # Server-Client (RLS)
    admin.ts         # Service-Role (nur serverseitig)
  anthropic.ts       # Anthropic-Client + Prompts
  leitner.ts         # Box-Logik (1-5, Review-Intervalle)
  grading.ts         # Pct → deutsche Note
supabase/
  migrations/        # SQL-Migrations
types/
  database.ts        # aus supabase-gen generiert
```

## Environment

Siehe `.env.local.example`. Lokal via `.env.local`, Produktion via Vercel-Env.

- `NEXT_PUBLIC_SUPABASE_URL` – öffentlich, ok im Browser
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – öffentlich, arbeitet mit RLS
- `SUPABASE_SERVICE_ROLE_KEY` – **niemals** im Client verwenden
- `ANTHROPIC_API_KEY` – **niemals** im Client verwenden

## Datenmodell (Kurzfassung)

- `lessons`: eine Lektion pro User (Name, Sprache)
- `vocabulary`: Vokabelpaare pro Lektion + Leitner-Box + Zähler
- `attempts`: Historie abgeschlossener Sessions, inkl. JSON mit Einzelergebnissen

Schema siehe `supabase/migrations/0001_init.sql`. **RLS ist scharf**, jeder User sieht nur eigene Daten.

## OCR-Pipeline

1. Client: User wählt 1–n Fotos (`<input capture="environment">`)
2. Client: FileReader → Base64, POST an `/api/extract`
3. Server: Anthropic-Vision-Call mit allen Bildern in einer Message → JSON `{ pairs: [{spanish, german}, ...] }`
4. Client: Review-Screen mit editierbarer Liste
5. Client: Save → Supabase-Insert in `lessons` + `vocabulary`

Immer damit rechnen, dass die Extraktion unsauber ist. Der User muss korrigieren können, bevor gespeichert wird.

## Leitner-System

- Neu gelernte Vokabel: Box 1
- Richtig beantwortet: Box +1 (max 5)
- Falsch beantwortet im Quiz/Test: Box -1 (min 1)
- Falsch im Lernmodus: zurück auf Box 1 (harte Zurücksetzung, weil Selbst-Einschätzung)
- "Schwache Wörter": Box 1–2 mit mind. einem Versuch

## Aussprache

Web Speech API (`SpeechSynthesis`, Sprache `es-ES`). Funktioniert auf iOS ab Safari 7+. Kein Fallback nötig.

## PWA

- `public/manifest.json` mit Icons 192/512 und `display: "standalone"`
- `<meta name="apple-mobile-web-app-capable" content="yes">` in Root-Layout
- Kein Service Worker im MVP (kommt später für Offline-Modus)
