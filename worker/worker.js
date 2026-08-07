/**
 * Lina & Team - Proxy Worker (Vorlage)
 * ------------------------------------
 * Kleiner Cloudflare-Worker, der als sicherer Vermittler zwischen der
 * Website und der Groq API dient. Der API-Key bleibt hier auf dem Server
 * (als "Secret") und wird NIE an den Browser geschickt.
 * Groq: kostenlos, keine Kreditkarte nötig (console.groq.com).
 *
 * Diese Datei ist bewusst als Vorlage gebaut: die Standard-Persönlich-
 * keiten unten sind neutral gehalten. Jeder kann sie in der Website unter
 * Einstellungen -> Persönlichkeit ohne Programmieren durch eigene Texte
 * ersetzen (wird als systemPromptOverride mitgeschickt).
 *
 * Optional reichert der Worker den Kontext mit persönlichen Momentauf-
 * nahmen an, aber NUR wenn die jeweilige Umgebungsvariable gesetzt ist -
 * ohne sie bleibt der Worker eine reine, unpersönliche Chat-Vorlage:
 *  - Kalender (Reclaim) über einen inoffiziellen, undokumentierten
 *    Endpunkt - kann jederzeit ohne Vorwarnung aufhören zu funktionieren.
 *    Fehler dabei werden abgefangen, der Chat läuft dann einfach ohne
 *    Kalenderkontext weiter. Aktivieren: Secret RECLAIM_API_KEY setzen
 *    (Key holen: app.reclaim.ai/settings/developer).
 *  - Ein öffentlich lesbarer Projektstatus (z.B. eine status.md auf
 *    GitHub) - Aktivieren: Variable PROJECT_STATUS_URL setzen.
 *  - Bis zu drei "Abteilungsberichte" für it/marketing/support (z.B. von
 *    eigenen Cloud-Agent-Routinen geschrieben) - Aktivieren: Variablen
 *    REPORT_URL_IT / REPORT_URL_MARKETING / REPORT_URL_SUPPORT setzen.
 *
 * Setup: siehe README.md im Hauptordner.
 */

// Standard-Persönlichkeiten pro Sprache. Wird die Website auf Englisch
// benutzt (Einstellungen -> Sprache), schickt sie lang:'en' mit - dann
// antwortet die KI auf Englisch, außer eine eigene Persönlichkeit
// (systemPromptOverride) überschreibt das ohnehin.
const SYSTEM_PROMPTS = {
  de: {
    lina: `Du bist Lina, eine persönliche Assistentin (PA).
Ton: warm, direkt, per du, Deutsch, keine Floskeln, keine Aufzählungspunkte
in normalen Antworten. Halte Antworten kurz und alltagstauglich, außer der
Nutzer bittet ausdrücklich um mehr Details.`,

    it: `Du bist der IT-Chef im Team (neben Lina, Marketing-Chef und
Support-Chef). Fokus: Technik, Code, Architektur, Debugging. Ton: sachlich,
präzise, lösungsorientiert, per du, Deutsch. Keine langen Vorträge, außer
ausdrücklich gewünscht.`,

    marketing: `Du bist der Marketing-Chef im Team (neben Lina, IT-Chef und
Support-Chef). Fokus: Positionierung, Zielgruppen, Kampagnen-Ideen,
Markenauftritt. Ton: kreativ, ideenreich, aber konkret und umsetzbar, per
du, Deutsch.`,

    support: `Du bist der Support-Chef im Team (neben Lina, IT-Chef und
Marketing-Chef). Fokus: Kundenerfahrung, Support-Prozesse, häufige
Nutzerprobleme. Ton: empathisch, klar, lösungsorientiert, per du, Deutsch.`,

    team: `Du repräsentierst das gesamte Team in einem Team-Meeting:
Lina (persönliche Assistentin), IT-Chef (Technik), Marketing-Chef
(Marketing), Support-Chef (Kundenservice).

Antworte NUR als die Person(en), die zur Frage wirklich etwas beizutragen
haben - meist reicht eine, manchmal zwei. Nicht alle vier müssen immer
sprechen.

Format ist PFLICHT: Jede Wortmeldung beginnt in einer eigenen Zeile exakt
mit "Name: " (z.B. "Lina: ..." oder "IT-Chef: ..." oder "Marketing-Chef: ..."
oder "Support-Chef: ..."), gefolgt vom Text dieser Person. Kein Vorspann,
keine Zusammenfassung danach, keine Moderation.`,
  },
  en: {
    lina: `You are Lina, a personal assistant (PA).
Tone: warm, direct, casual, English, no filler phrases, no bullet points in
normal replies. Keep answers short and practical, unless the user
explicitly asks for more detail.`,

    it: `You are the IT Lead on the team (alongside Lina, the Marketing Lead
and Support Lead). Focus: technology, code, architecture, debugging. Tone:
matter-of-fact, precise, solution-oriented, casual, English. No long
lectures unless explicitly requested.`,

    marketing: `You are the Marketing Lead on the team (alongside Lina, the
IT Lead and Support Lead). Focus: positioning, target audiences, campaign
ideas, brand presence. Tone: creative, idea-driven, but concrete and
actionable, casual, English.`,

    support: `You are the Support Lead on the team (alongside Lina, the IT
Lead and Marketing Lead). Focus: customer experience, support processes,
common user issues. Tone: empathetic, clear, solution-oriented, casual,
English.`,

    team: `You represent the whole team in a team meeting:
Lina (personal assistant), IT Lead (tech), Marketing Lead (marketing),
Support Lead (customer service).

Reply ONLY as the person/people who actually have something relevant to
add - usually one, sometimes two. Not all four need to speak every time.

Format is MANDATORY: each contribution starts on its own line exactly with
"Name: " (e.g. "Lina: ..." or "IT Lead: ..." or "Marketing Lead: ..." or
"Support Lead: ..."), followed by that person's text. No preamble, no
summary afterwards, no moderation.`,
  },
};

// Wird an jede Anfrage angehängt, egal ob Standard- oder eigener
// System-Prompt aus den Einstellungen verwendet wird.
const CONTEXT_NOTE = {
  de: `Kontext-Hinweis: Falls unten ein Kalenderausschnitt und/oder ein
Projektstatus mitgeschickt wurden, dürft ihr die verwenden, wenn danach
gefragt wird. Beides ist nur eine unregelmäßig aktualisierte Momentaufnahme
(kein Live-Zugriff, keine Schreibrechte, keine Garantie auf Vollständigkeit)
- wenn etwas fehlt oder Termine angelegt/geändert werden sollen, freundlich
darauf hinweisen, dass dafür die Kalender-App direkt genutzt werden soll.`,
  en: `Context note: if a calendar snippet and/or a project status were
included below, feel free to use them when asked. Both are only an
irregularly updated snapshot (no live access, no write permissions, no
guarantee of completeness) - if something is missing or the user wants to
create/change an appointment, kindly point out that they should use the
calendar app directly for that.`,
};

function langOf(body) {
  return body && body.lang === 'en' ? 'en' : 'de';
}

// Eigene Persönlichkeit aus den Einstellungen (Settings -> Persönlichkeit)
// wird ungeprüft als System-Prompt verwendet - das ist bewusst so (man
// schreibt nur seinem eigenen Worker/Key eine Anweisung, kein
// Sicherheitsrisiko für andere), aber auf eine sinnvolle Länge gedeckelt.
const MAX_SYSTEM_PROMPT_CHARS = 3000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
};

const GROQ_MODEL = 'qwen/qwen3.6-27b'; // multimodal - kann Text und Bilder

// Groq-TTS-Stimme (Orpheus, offizielle Groq-API - kostenlos, zuverlässig,
// aber nur Englisch. Der Chat-Text bleibt Deutsch; die Stimme liest ihn mit
// englischer Aussprache vor). Alle Personas nutzen dieselbe Stimme.
const GROQ_TTS_MODEL = 'canopylabs/orpheus-v1-english';
const GROQ_VOICE_NAME = 'hannah';

async function fetchGroqTTSAudio(text, voiceName, env) {
  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_TTS_MODEL,
      input: String(text || '').slice(0, 2000),
      voice: voiceName,
      response_format: 'wav',
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq TTS error (${res.status}): ${errText.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function contentToGroqContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(block => {
      if (block.type === 'image') {
        return {
          type: 'image_url',
          image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
        };
      }
      return { type: 'text', text: block.text || '' };
    });
  }
  return '';
}

function toGroqMessages(messages, systemText) {
  const out = [{ role: 'system', content: systemText }];
  messages.forEach(m => {
    out.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: contentToGroqContent(m.content),
    });
  });
  return out;
}

function formatEventTime(value) {
  const d = value ? new Date(value) : null;
  if (!d || isNaN(d.getTime())) return '';
  return d.toISOString().slice(11, 16) + ' UTC';
}

function formatEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const lines = events.slice(0, 15).map(ev => {
    const title = ev.title || ev.summary || ev.eventTitle || '(ohne Titel)';
    const start = ev.eventStart || ev.start?.dateTime || ev.start || '';
    const end = ev.eventEnd || ev.end?.dateTime || ev.end || '';
    const startT = formatEventTime(start);
    const endT = formatEventTime(end);
    const time = startT && endT ? `${startT}–${endT}` : (startT || '');
    return `- ${time ? time + ' ' : ''}${title}`.trim();
  });
  return lines.join('\n');
}

// Undokumentierter Reclaim-Endpunkt - bewusst defensiv: jeder Fehler führt
// nur dazu, dass der Kalenderkontext fehlt, nie zu einem kompletten Ausfall.
function toReclaimDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

async function fetchCalendarContext(env) {
  if (!env.RECLAIM_API_KEY) return null;
  try {
    const now = Date.now();
    // Reclaim akzeptiert nur ein reines Datum (YYYY-MM-DD), keine Uhrzeit.
    const start = toReclaimDate(new Date(now - 6 * 3600 * 1000));
    const end = toReclaimDate(new Date(now + 30 * 3600 * 1000));
    const res = await fetch(
      `https://api.app.reclaim.ai/api/events/personal?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      { headers: { Authorization: `Bearer ${env.RECLAIM_API_KEY}` } }
    );
    if (!res.ok) return null;
    const events = await res.json();
    const formatted = formatEvents(events);
    if (!formatted) return null;
    return `Kalenderausschnitt (ungefähr die nächsten ~24-30h, Zeiten in UTC, kann leicht von der lokalen Zeitzone abweichen):\n${formatted}`;
  } catch {
    return null;
  }
}

async function fetchProjectStatusContext(env) {
  if (!env.PROJECT_STATUS_URL) return null;
  try {
    const res = await fetch(env.PROJECT_STATUS_URL);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text) return null;
    return `Aktueller Projektstatus (Momentaufnahme, ggf. nicht mehr ganz aktuell):\n${text}`;
  } catch {
    return null;
  }
}

// Optionale Berichte der Abteilungs-Agents (z.B. von eigenen Cloud-Agent-
// Routinen geschrieben) - pro Person über eine eigene Umgebungsvariable
// aktivierbar, standardmäßig aus.
const REPORT_URL_ENV_KEYS = {
  it: 'REPORT_URL_IT',
  marketing: 'REPORT_URL_MARKETING',
  support: 'REPORT_URL_SUPPORT',
};

// Auf ~800 Zeichen gekürzt, um das Groq-Tokenbudget (8000 TPM im Gratis-
// Tarif) nicht bei jeder einzelnen Nachricht unnötig zu belasten.
const MAX_REPORT_CHARS = 800;

async function fetchDepartmentReport(persona, env) {
  const url = env[REPORT_URL_ENV_KEYS[persona]];
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    let text = (await res.text()).trim();
    if (!text) return null;
    if (text.length > MAX_REPORT_CHARS) {
      text = text.slice(0, MAX_REPORT_CHARS) + '\n[…gekürzt, vollständiger Bericht liegt im Repo unter reports/]';
    }
    return `Dein letzter eigener Arbeitsbericht (automatischer Lauf, echte Analyse/Vorschläge, kein Live-Stand):\n${text}`;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // Zugangscode-Sperre: nur aktiv, wenn ACCESS_CODE als Secret gesetzt ist.
    if (env.ACCESS_CODE && request.headers.get('X-Access-Code') !== env.ACCESS_CODE) {
      return jsonResponse({ error: 'Falscher oder fehlender Zugangscode' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    // Sprachausgabe (Groq TTS, Englisch) - separater Zweig, gleicher
    // Endpunkt. Bei jedem Fehler springt das Frontend automatisch auf die
    // Browser-eigene Stimme zurück (speakFallback in index.html).
    if (body.action === 'speak') {
      try {
        const audioBuffer = await fetchGroqTTSAudio(body.text, GROQ_VOICE_NAME, env);
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          return jsonResponse({ error: 'Groq TTS: kein Audio erhalten' }, 502);
        }
        return jsonResponse({ audio: arrayBufferToBase64(audioBuffer), mime: 'audio/wav' });
      } catch (err) {
        return jsonResponse({ error: err.message }, 502);
      }
    }

    const lang = langOf(body);
    const persona = SYSTEM_PROMPTS[lang][body.persona] ? body.persona : 'lina';

    // Eigene Persönlichkeit aus den Einstellungen (nicht für 'team' - das
    // feste Format "Name: Text" muss für den Gruppenchat erhalten bleiben).
    let personaPrompt = SYSTEM_PROMPTS[lang][persona];
    if (persona !== 'team' && typeof body.systemPromptOverride === 'string' && body.systemPromptOverride.trim()) {
      personaPrompt = body.systemPromptOverride.trim().slice(0, MAX_SYSTEM_PROMPT_CHARS);
    }

    const [calendarContext, projectContext, departmentReport] = await Promise.all([
      fetchCalendarContext(env),
      fetchProjectStatusContext(env),
      fetchDepartmentReport(persona, env),
    ]);

    const systemText = [personaPrompt, CONTEXT_NOTE[lang], calendarContext, projectContext, departmentReport]
      .filter(Boolean)
      .join('\n\n');

    const messages = toGroqMessages(body.messages || [], systemText);

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          max_tokens: 2048, // qwen3.6 verbraucht Tokens fürs "Denken" vor der eigentlichen Antwort
          reasoning_format: 'hidden', // Denkteil serverseitig unterdrücken statt nachträglich rausfiltern
        }),
      });

      const data = await groqRes.json();

      if (!groqRes.ok) {
        return jsonResponse({ error: data.error?.message || 'Groq API error' }, groqRes.status);
      }

      let reply = data.choices?.[0]?.message?.content || '';
      // Sicherheitsnetz: falls reasoning_format ignoriert wird oder der
      // Denkteil vor dem schließenden Tag abgeschnitten wird (Modell rennt
      // ins Token-Limit), nie rohen Gedankengang an den Nutzer weitergeben.
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (!reply || reply.includes('<think>')) {
        reply = lang === 'en'
          ? "Sorry, my reply got too long/complex and was cut off. Mind asking again a bit shorter?"
          : 'Sorry, meine Antwort ist mir zu lang/komplex geraten und wurde abgeschnitten. Magst du die Frage nochmal kürzer stellen?';
      }

      return jsonResponse({ reply });
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};
