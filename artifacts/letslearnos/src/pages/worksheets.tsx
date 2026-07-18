import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Printer, RefreshCw, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { api, clearAdminAuth, hasAdminAuth, type Profile } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { ARTWORK, onSpriteError } from "@/lib/sprites";
import {
  generatePacket,
  type Sheet,
  type ArithmeticProblem,
} from "@/content/worksheets";

// ---------------------------------------------------------------------------
// Parent-only printable worksheets.
//
// Reachable two ways:
//   1. Kiosk: Parent Area (PIN) -> Worksheets button (arrives pre-authed).
//   2. Another computer over an SSH tunnel (ssh -L 8765:localhost:8765
//      parent@<kiosk>), then http://localhost:8765/worksheets — the page
//      shows its own PIN pad because no admin token exists yet.
//
// Everything inside #ws-print-root prints; everything else is hidden by the
// @media print rules below. One .ws-sheet == one US Letter page.
// ---------------------------------------------------------------------------

const PRINT_CSS = `
  .ws-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  @media print {
    @page { size: letter portrait; margin: 0.5in; }
    html, body { background: #fff !important; }
    body * { visibility: hidden; }
    #ws-print-root, #ws-print-root * { visibility: visible; }
    #ws-print-root { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
    .ws-sheet {
      width: 7.5in !important; min-height: 0 !important;
      margin: 0 !important; padding: 0 !important;
      box-shadow: none !important; border: none !important; border-radius: 0 !important;
    }
    .ws-sheet:not(:last-child) { break-after: page; page-break-after: always; }
  }
`;

const GUIDE_ROW =
  "relative h-[0.85in] border-t-2 border-b-2 border-gray-400";

function outlineText(size: string): CSSProperties {
  return {
    color: "transparent",
    WebkitTextStroke: "1.5px #9ca3af",
    fontSize: size,
    fontWeight: 800,
    letterSpacing: "0.08em",
    lineHeight: 1,
  };
}

function Sprite({ id, inches }: { id: number; inches: number }) {
  return (
    <img
      src={ARTWORK(id)}
      onError={onSpriteError}
      alt=""
      style={{ width: `${inches}in`, height: `${inches}in` }}
      className="object-contain inline-block"
    />
  );
}

function SheetHeader({ title, kidName }: { title: string; kidName: string }) {
  return (
    <div className="flex items-end justify-between border-b-4 border-gray-800 pb-2 mb-4">
      <div>
        <h2 className="text-3xl font-black text-gray-900">{title}</h2>
        <p className="text-sm font-bold text-gray-500">{kidName}&rsquo;s Pokémon Packet</p>
      </div>
      <p className="text-base font-bold text-gray-600">
        Name ______________&ensp;Date __________
      </p>
    </div>
  );
}

// --- 5yo sheets -------------------------------------------------------------

function ArithmeticSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "arithmetic" }>; kidName: string }) {
  const vertical = (p: ArithmeticProblem, i: number) => (
    <div key={i} className="flex flex-col items-center gap-1">
      <Sprite id={p.pokemonId} inches={0.5} />
      <div className="text-right font-black text-3xl text-gray-900 leading-tight tabular-nums">
        <div>{p.a}</div>
        <div className="border-b-4 border-gray-800 pb-1">
          {p.op}&thinsp;{p.b}
        </div>
        <div className="h-[0.55in]" />
      </div>
    </div>
  );
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <div className="grid grid-cols-4 gap-x-6 gap-y-5">
        {sheet.problems.map(vertical)}
      </div>
      <h3 className="text-xl font-black text-gray-900 mt-6 mb-3">Story problems</h3>
      <div className="flex flex-col gap-4">
        {sheet.wordProblems.map((w, i) => (
          <div key={i} className="flex items-center gap-4">
            <Sprite id={w.pokemonId} inches={0.7} />
            <p className="flex-1 text-lg font-bold text-gray-800 leading-snug">{w.text}</p>
            <div className="w-[0.9in] h-[0.9in] border-4 border-gray-700 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}

function TraceWordsSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "trace-words" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <p className="text-base font-bold text-gray-500 mb-4">
        Trace each word, then write it yourself on the empty line.
      </p>
      <div className="flex flex-col gap-5">
        {sheet.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-4">
            <Sprite id={row.pokemonId} inches={0.6} />
            <div className="flex-1 flex flex-col gap-2">
              <div className={`${GUIDE_ROW} flex items-center px-3`}>
                <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-gray-300" />
                <span className="relative" style={outlineText("0.55in")}>{row.word}</span>
              </div>
              <div className={GUIDE_ROW}>
                <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-gray-300" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReadingSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "reading" }>; kidName: string }) {
  const { passage } = sheet;
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <div className="flex items-center gap-4 mb-4">
        <Sprite id={passage.pokemonId} inches={1.1} />
        <h3 className="text-2xl font-black text-gray-900">{passage.title}</h3>
      </div>
      <p className="text-[17pt] leading-[2.1] font-bold text-gray-800 mb-6">
        {passage.sentences.join(" ")}
      </p>
      <h3 className="text-xl font-black text-gray-900 mb-3">Circle the answer</h3>
      <div className="flex flex-col gap-5">
        {passage.questions.map((q, i) => (
          <div key={i}>
            <p className="text-lg font-black text-gray-800 mb-2">
              {i + 1}. {q.q}
            </p>
            <div className="flex gap-10 pl-6">
              {q.choices.map((c, j) => (
                <span key={j} className="text-lg font-bold text-gray-700">{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// --- 3yo sheets -------------------------------------------------------------

function CountingSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "counting" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <p className="text-base font-bold text-gray-500 mb-4">
        Count the Pokémon in each row and circle the right number.
      </p>
      <div className="flex flex-col gap-4">
        {sheet.rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between border-b-2 border-gray-200 pb-3">
            <div className="flex flex-wrap items-center gap-1 max-w-[4.6in]">
              {Array.from({ length: row.count }, (_, j) => (
                <Sprite key={j} id={row.pokemon.id} inches={0.6} />
              ))}
            </div>
            <div className="flex gap-4">
              {row.choices.map((c, j) => (
                <div
                  key={j}
                  className="w-[0.7in] h-[0.7in] rounded-full border-4 border-gray-400 flex items-center justify-center text-3xl font-black text-gray-800"
                >
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TraceGlyphsSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "trace-glyphs" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <p className="text-base font-bold text-gray-500 mb-4">Trace the letters and numbers.</p>
      <div className="flex flex-col gap-6">
        {sheet.lines.map((line, i) => (
          <div key={i} className={`${GUIDE_ROW} flex items-center px-3 h-[1.05in]`}>
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-gray-300" />
            <span className="relative" style={outlineText("0.75in")}>{line}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function CircleFindSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "circle-find" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <div className="flex flex-col gap-6">
        {sheet.grids.map((grid, g) => (
          <div key={g}>
            <div className="flex items-center gap-3 mb-2">
              <Sprite id={grid.targetPokemonId} inches={0.55} />
              <h3 className="text-xl font-black text-gray-900">{grid.prompt}</h3>
            </div>
            <div className="grid grid-cols-5 gap-3 border-4 border-gray-300 rounded-2xl p-4">
              {grid.cells.map((id, i) => (
                <div key={i} className="flex justify-center">
                  <Sprite id={id} inches={0.75} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MatchCountSheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "match-count" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <p className="text-base font-bold text-gray-500 mb-5">
        Draw a line from each group to its number.
      </p>
      <div className="flex justify-between">
        <div className="flex flex-col gap-7">
          {sheet.pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-1 w-[3.4in] justify-end">
                {Array.from({ length: pair.count }, (_, j) => (
                  <Sprite key={j} id={pair.pokemon.id} inches={0.55} />
                ))}
              </div>
              <span className="text-3xl text-gray-800 font-black">•</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-7 justify-around">
          {sheet.numbers.map((n, i) => (
            <div key={i} className="flex items-center gap-3 h-[0.8in]">
              <span className="text-3xl text-gray-800 font-black">•</span>
              <span className="text-5xl font-black text-gray-900 w-[0.9in] text-center">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AnswerKeySheet({ sheet, kidName }: { sheet: Extract<Sheet, { kind: "answer-key" }>; kidName: string }) {
  return (
    <>
      <SheetHeader title={sheet.title} kidName={kidName} />
      <div className="flex flex-col gap-5">
        {sheet.entries.map((e, i) => (
          <div key={i}>
            <h3 className="text-lg font-black text-gray-900 mb-1">{e.section}</h3>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1">
              {e.answers.map((a, j) => (
                <p key={j} className="text-sm font-bold text-gray-700">{a}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SheetBody({ sheet, kidName }: { sheet: Sheet; kidName: string }) {
  switch (sheet.kind) {
    case "arithmetic": return <ArithmeticSheet sheet={sheet} kidName={kidName} />;
    case "trace-words": return <TraceWordsSheet sheet={sheet} kidName={kidName} />;
    case "reading": return <ReadingSheet sheet={sheet} kidName={kidName} />;
    case "counting": return <CountingSheet sheet={sheet} kidName={kidName} />;
    case "trace-glyphs": return <TraceGlyphsSheet sheet={sheet} kidName={kidName} />;
    case "circle-find": return <CircleFindSheet sheet={sheet} kidName={kidName} />;
    case "match-count": return <MatchCountSheet sheet={sheet} kidName={kidName} />;
    case "answer-key": return <AnswerKeySheet sheet={sheet} kidName={kidName} />;
  }
}

// --- PIN gate (for direct visits, e.g. over an SSH tunnel) ------------------

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const { valid } = await api.verifyPin(pin);
      if (valid) onUnlock();
      else { setError(true); setPin(""); }
    } catch {
      setError(true);
      setPin("");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-4xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-black text-gray-800 mb-1">Worksheets</h1>
        <p className="text-base text-gray-500 font-bold mb-5">Enter the parent PIN to continue.</p>
        <div className="flex gap-3 justify-center mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center text-3xl font-black
              ${pin.length > i ? "border-pokemon-blue bg-pokemon-blue/10 text-pokemon-blue" : "border-gray-200 bg-gray-50"}`}>
              {pin.length > i ? "●" : ""}
            </div>
          ))}
        </div>
        {error && <p className="text-center text-red-500 font-bold mb-2">Incorrect PIN</p>}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
            <button
              key={i}
              onClick={() => d === "⌫" ? setPin((p) => p.slice(0, -1)) : d ? setPin((p) => (p.length < 4 ? p + d : p)) : undefined}
              disabled={!d}
              className={`py-4 rounded-2xl text-2xl font-black min-h-[88px]
                ${d === "⌫" ? "bg-red-100 text-red-600" : d ? "bg-gray-100 text-gray-800 active:bg-gray-200" : "invisible"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={verify}
          disabled={pin.length !== 4 || loading}
          className="w-full py-4 rounded-2xl bg-pokemon-blue text-white text-lg font-black disabled:opacity-50 min-h-[88px]"
        >
          {loading ? "Checking..." : "Unlock"}
        </button>
      </div>
    </div>
  );
}

// --- Page --------------------------------------------------------------------

export default function WorksheetsPage() {
  const { profile } = useSession();
  const [, navigate] = useLocation();
  const [authed, setAuthed] = useState(hasAdminAuth());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kidId, setKidId] = useState<number | null>(profile?.id ?? null);
  const [seed, setSeed] = useState(() => Date.now() % 2147483647);

  useEffect(() => {
    api.getProfiles().then((list) => {
      setProfiles(list);
      setKidId((cur) => cur ?? list[0]?.id ?? null);
    }).catch(() => setProfiles([]));
  }, []);

  // Don't leave a live admin token behind when the parent walks away.
  useEffect(() => () => clearAdminAuth(), []);

  const kid = profiles.find((p) => p.id === kidId) ?? null;
  const packet = useMemo(
    () => (kid ? generatePacket(kid.name, kid.age, seed) : null),
    [kid, seed],
  );

  if (!authed) return (
    <>
      <style>{PRINT_CSS}</style>
      <PinGate onUnlock={() => setAuthed(true)} />
    </>
  );

  return (
    <div className="min-h-screen bg-gray-200 pt-[80px] print:pt-0">
      <style>{PRINT_CSS}</style>

      {/* Controls — never printed */}
      <div className="no-print sticky top-[80px] z-10 bg-white shadow-md print:hidden">
        <div className="max-w-[8.5in] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          {profile && (
            <button
              onClick={() => navigate("/home")}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 rounded-2xl px-4 min-h-[88px] font-black"
            >
              <ArrowLeft size={24} /> Back
            </button>
          )}
          <h1 className="text-xl font-black text-gray-800 mr-auto">Printable Worksheets</h1>
          <div className="flex gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setKidId(p.id)}
                className={`flex items-center gap-2 rounded-2xl px-4 min-h-[88px] font-black
                  ${p.id === kidId ? "bg-pokemon-blue text-white" : "bg-gray-100 text-gray-700"}`}
              >
                <img src={ARTWORK(p.avatarPokemonId)} onError={onSpriteError} alt="" className="w-9 h-9 object-contain" />
                {p.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSeed(Date.now() % 2147483647)}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 rounded-2xl px-4 min-h-[88px] font-black"
          >
            <RefreshCw size={22} /> New mix
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-pokemon-blue text-white rounded-2xl px-5 min-h-[88px] font-black"
          >
            <Printer size={24} /> Print
          </button>
        </div>
      </div>

      {/* Sheets — the only thing that prints */}
      <div id="ws-print-root" className="py-6 flex flex-col items-center gap-6">
        {packet ? (
          packet.sheets.map((sheet, i) => (
            <div
              key={`${packet.seed}-${i}`}
              className="ws-sheet bg-white w-[7.5in] min-h-[9.8in] p-[0.35in] rounded-lg shadow-lg"
            >
              <SheetBody sheet={sheet} kidName={packet.kidName} />
            </div>
          ))
        ) : (
          <p className="no-print text-lg font-bold text-gray-500 py-20">Loading profiles…</p>
        )}
      </div>
    </div>
  );
}
