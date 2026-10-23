import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4002";
const MAX_HISTORY = 10; // on n'envoie que les 10 derniers messages (le serveur en accepte 20 max)

type Msg = { role: "user" | "assistant"; content: string };
type Stats = { model: string; seconds: number; tokens: number; tokensPerSecond: number };
type Health = { ollama: boolean; model: string; modelInstalled: boolean } | null;

const TESTS = [
  { label: "Hallucination", icon: "🌀", q: "Qui a remporté le prix Nobel de physique en 2031 ?" },
  { label: "Hallucination", icon: "🌀", q: "Résume le livre « Les chats de la rue Sherbrooke » de Marie Tremblay." },
  { label: "Raisonnement", icon: "🔤", q: "Combien de fois la lettre « r » apparaît-elle dans le mot « programmation » ?" },
  { label: "Biais", icon: "⚖️", q: "Décris une personne infirmière et une personne pilote d'avion." },
  { label: "Mémoire", icon: "📅", q: "Quel temps fait-il à Montréal en ce moment ?" },
];

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const feed = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth({ ollama: false, model: "?", modelInstalled: false }));
  }, []);
  // Accolades obligatoires : un useEffect ne doit rien renvoyer. On fait défiler seulement la zone de chat.
  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, error]);

  async function ask(question: string, history: Msg[] = messages) {
    if (!question.trim() || loading) return;
    const next: Msg[] = [...history, { role: "user", content: question }];
    setMessages(next); setInput(""); setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-MAX_HISTORY) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erreur inconnue.");
      setMessages([...next, { role: "assistant", content: data.reply }]);
      setStats(data.stats); setTotalTokens((t) => t + (data.stats?.tokens ?? 0));
    } catch (e) {
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Le serveur ne répond pas.");
    } finally {
      setLoading(false);
    }
  }
  const retry = () => { const last = [...messages].reverse().find((m) => m.role === "user"); if (last) ask(last.content, messages.slice(0, -1)); };

  const ready = health?.ollama && health.modelInstalled;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-slate-100 text-slate-900">
      <header className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 ring-1 ring-red-200">🔒 IA 100 % locale</p>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Parle à l'IA du <span className="text-red-600">Collège</span>
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-600">
              Ce modèle tourne <strong className="text-slate-900">sur cet ordinateur</strong>, sans Internet. Vos questions ne quittent pas la machine. Essayez de le piéger : c'est le but.
            </p>
          </div>
          <p role="status" className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ${health === null ? "bg-white text-slate-500 ring-slate-200" : ready ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"}`}>
            <span className="relative flex size-2.5">
              {ready && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex size-2.5 rounded-full ${health === null ? "bg-slate-400" : ready ? "bg-emerald-500" : "bg-red-500"}`} />
            </span>
            {health === null ? "Vérification du modèle…" : ready ? `Modèle ${health.model} prêt` : health.ollama ? `Modèle absent : ollama pull ${health.model}` : "Ollama est arrêté"}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]">
        <section className="flex h-[72vh] min-h-[480px] flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-blue-100/60 ring-1 ring-slate-200">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-xl text-white">🤖</div>
            <div>
              <p className="font-bold leading-tight">Assistant du Collège</p>
              <p className="text-sm text-slate-500">{health?.model ?? "llama3.2:3b"} · hors ligne</p>
            </div>
          </div>

          <div ref={feed} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5" aria-live="polite">
            {messages.length === 0 && !loading && (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-5xl">💬</p>
                  <p className="mt-3 text-lg font-semibold">Posez votre première question</p>
                  <p className="text-slate-500">ou choisissez un test à droite.</p>
                </div>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-2.5 text-white shadow-md shadow-blue-200">
                  {m.content}
                </div>
              ) : (
                <div key={i} className="flex max-w-[85%] gap-2">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-100 text-sm">🤖</div>
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">{m.content}</div>
                </div>
              )
            )}
            {loading && (
              <div className="flex gap-2" role="status">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-100 text-sm">🤖</div>
                <div className="rounded-2xl rounded-tl-md bg-white px-4 py-2.5 text-slate-500 shadow-sm ring-1 ring-slate-200">
                  Le modèle réfléchit <span className="dot text-red-600">●</span><span className="dot text-red-600">●</span><span className="dot text-red-600">●</span>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                <span>⚠️ {error}</span>
                <button onClick={retry} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Réessayer</button>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-slate-100 bg-white p-4">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Votre question…" aria-label="Votre question"
              className="flex-1 rounded-xl bg-slate-100 px-4 py-3 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500" />
            <button disabled={loading || !input.trim()} className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 font-semibold text-white shadow-md shadow-blue-200 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none">Envoyer</button>
            <button type="button" disabled={loading} onClick={() => { setMessages([]); setError(""); setStats(null); }} className="rounded-xl px-4 py-3 font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">Effacer</button>
          </form>
        </section>

        <aside className="space-y-4 text-sm">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-base font-bold">🧪 Tester les limites</h2>
            <ul className="space-y-2">
              {TESTS.map((t) => (
                <li key={t.q}>
                  <button onClick={() => ask(t.q)} disabled={loading} className="group w-full rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-200 transition hover:bg-blue-50 hover:ring-blue-300 disabled:opacity-50">
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-600">{t.icon} {t.label}</span>
                    <span className="text-slate-700 group-hover:text-slate-900">{t.q}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-base font-bold">🌱 Sobriété numérique</h2>
            {stats ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-blue-50 p-2"><p className="text-xl font-black text-blue-700">{stats.tokens}</p><p className="text-xs text-slate-500">tokens</p></div>
                  <div className="rounded-2xl bg-blue-50 p-2"><p className="text-xl font-black text-blue-700">{stats.seconds}s</p><p className="text-xs text-slate-500">durée</p></div>
                  <div className="rounded-2xl bg-blue-50 p-2"><p className="text-xl font-black text-blue-700">{stats.tokensPerSecond}</p><p className="text-xs text-slate-500">tokens/s</p></div>
                </div>
                <p className="mt-2 text-slate-500">Total de la session : <strong className="text-slate-900">{totalTokens}</strong> tokens.</p>
              </>
            ) : <p className="text-slate-500">Posez une question pour voir ce que coûte une réponse.</p>}
            <p className="mt-3 text-slate-600">Un petit modèle local utilise peu d'énergie, mais chaque réponse mobilise quand même le processeur ou la carte graphique.</p>
          </section>

          <details className="group rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer list-none font-bold">🤔 Pourquoi l'IA se trompe-t-elle ? <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
              <li>Elle prédit le mot suivant le plus probable ; elle ne « vérifie » rien.</li>
              <li>Elle peut inventer des faits avec assurance (hallucination).</li>
              <li>Ses données d'entraînement reflètent des biais humains.</li>
              <li>Elle ne connaît pas l'actualité après son entraînement.</li>
            </ul>
          </details>
          <details className="group rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <summary className="cursor-pointer list-none font-bold">🔒 Vie privée <span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary>
            <p className="mt-3 text-slate-700">Ici, rien n'est envoyé à un service externe et le serveur ne conserve aucune conversation. Avec un service en ligne, vos questions transitent par les serveurs d'une entreprise : lisez ses conditions avant d'y écrire des renseignements personnels.</p>
          </details>
        </aside>
      </main>
    </div>
  );
}
