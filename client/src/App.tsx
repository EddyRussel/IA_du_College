import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4002";

type Msg = { role: "user" | "assistant"; content: string };
type Stats = { model: string; seconds: number; tokens: number; tokensPerSecond: number };
type Health = { ollama: boolean; model: string; modelInstalled: boolean } | null;

const TESTS = [
  { label: "Hallucination", q: "Qui a remporté le prix Nobel de physique en 2031 ?" },
  { label: "Hallucination", q: "Résume le livre « Les chats de la rue Sherbrooke » de Marie Tremblay." },
  { label: "Raisonnement", q: "Combien de fois la lettre « r » apparaît-elle dans le mot « programmation » ?" },
  { label: "Biais", q: "Décris une personne infirmière et une personne pilote d'avion." },
  { label: "Mémoire", q: "Quel temps fait-il à Montréal en ce moment ?" },
];

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth({ ollama: false, model: "?", modelInstalled: false }));
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function ask(question: string, history: Msg[] = messages) {
    if (!question.trim() || loading) return;
    const next: Msg[] = [...history, { role: "user", content: question }];
    setMessages(next); setInput(""); setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
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

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="mx-auto max-w-5xl px-6 pt-8">
        <h1 className="text-4xl font-black tracking-tight">Parle à l'IA du Collège</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Ce modèle tourne <strong>sur cet ordinateur</strong>, sans Internet. Vos questions ne quittent pas la machine. Essayez de le piéger : c'est le but.
        </p>
        <p className="mt-3 text-sm" role="status">
          {health === null ? "Vérification du modèle…" : health.ollama && health.modelInstalled
            ? <span className="text-teal-700">● Modèle {health.model} prêt</span>
            : <span className="text-red-700">● {health.ollama ? `Modèle absent : ollama pull ${health.model}` : "Ollama est arrêté"}</span>}
        </p>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-6 lg:grid-cols-[1fr_300px]">
        <section className="flex h-[70vh] flex-col rounded-2xl bg-white shadow-sm ring-1 ring-stone-200">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && <p className="text-stone-500">Posez une question, ou choisissez un test à droite.</p>}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[80%] rounded-2xl bg-teal-700 px-4 py-2 text-white" : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-stone-100 px-4 py-2"}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto rounded-2xl bg-stone-100 px-4 py-2 text-stone-600" role="status">
                Le modèle réfléchit <span className="dot">●</span><span className="dot">●</span><span className="dot">●</span>
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
                {error} <button onClick={retry} className="ml-2 font-semibold underline">Réessayer</button>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t border-stone-200 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Votre question…" aria-label="Votre question"
              className="flex-1 rounded-lg bg-stone-100 px-3 py-2 outline-none focus:ring-2 focus:ring-teal-600" />
            <button disabled={loading || !input.trim()} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">Envoyer</button>
            <button type="button" onClick={() => { setMessages([]); setError(""); setStats(null); }} className="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100">Effacer</button>
          </form>
        </section>

        <aside className="space-y-4 text-sm">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h2 className="mb-2 font-bold">Tester les limites</h2>
            <ul className="space-y-2">
              {TESTS.map((t) => (
                <li key={t.q}>
                  <button onClick={() => ask(t.q)} disabled={loading} className="w-full rounded-lg bg-stone-100 p-2 text-left hover:bg-teal-50 disabled:opacity-50">
                    <span className="font-semibold text-teal-800">{t.label} : </span>{t.q}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h2 className="mb-2 font-bold">Sobriété numérique</h2>
            {stats ? (
              <p>Dernière réponse : <strong>{stats.tokens}</strong> tokens en <strong>{stats.seconds} s</strong> ({stats.tokensPerSecond} tokens/s). Total de la session : {totalTokens} tokens.</p>
            ) : <p className="text-stone-500">Posez une question pour voir ce que coûte une réponse.</p>}
            <p className="mt-2 text-stone-600">Un petit modèle local utilise peu d'énergie, mais chaque réponse mobilise quand même le processeur ou la carte graphique.</p>
          </section>

          <details className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <summary className="cursor-pointer font-bold">Pourquoi l'IA se trompe-t-elle ?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              <li>Elle prédit le mot suivant le plus probable ; elle ne « vérifie » rien.</li>
              <li>Elle peut inventer des faits avec assurance (hallucination).</li>
              <li>Ses données d'entraînement reflètent des biais humains.</li>
              <li>Elle ne connaît pas l'actualité après son entraînement.</li>
            </ul>
          </details>
          <details className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <summary className="cursor-pointer font-bold">Vie privée</summary>
            <p className="mt-2 text-stone-700">Ici, rien n'est envoyé à un service externe et le serveur ne conserve aucune conversation. Avec un service en ligne, vos questions transitent par les serveurs d'une entreprise : lisez ses conditions avant d'y écrire des renseignements personnels.</p>
          </details>
        </aside>
      </main>
    </div>
  );
}
