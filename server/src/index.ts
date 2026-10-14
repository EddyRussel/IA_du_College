import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT ?? 4002);
const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000);
const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

const SYSTEM = `Tu es l'assistant du Collège, présent aux portes ouvertes. Réponds en français, de façon courte (4 phrases maximum), claire et amicale.
Si tu n'es pas certain d'un fait, dis-le. N'invente jamais de noms, de dates ni de programmes du Collège.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "50kb" }));

// Vie privée : on ne journalise JAMAIS le contenu des conversations.
app.get("/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const data = (await r.json()) as { models?: { name: string }[] };
    const installed = (data.models ?? []).some((m) => m.name.startsWith(MODEL.split(":")[0]));
    res.json({ ollama: true, model: MODEL, modelInstalled: installed });
  } catch {
    res.status(503).json({ ollama: false, model: MODEL, modelInstalled: false });
  }
});

app.post("/chat", async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;
  const valid =
    Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_MESSAGES &&
    messages.every((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= MAX_CHARS);
  if (!valid) return res.status(400).json({ error: `Requête invalide (1 à ${MAX_MESSAGES} messages, ${MAX_CHARS} caractères max).` });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [{ role: "system", content: SYSTEM }, ...messages],
        options: { temperature: 0.7, num_predict: 400 },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const detail = r.status === 404 ? `Modèle « ${MODEL} » absent. Lancez : ollama pull ${MODEL}` : `Ollama a répondu ${r.status}.`;
      return res.status(502).json({ error: detail });
    }
    const d: any = await r.json();
    res.json({
      reply: d.message?.content ?? "",
      stats: {
        model: d.model,
        seconds: Number((d.total_duration / 1e9).toFixed(1)),
        tokens: d.eval_count,
        tokensPerSecond: Number((d.eval_count / (d.eval_duration / 1e9)).toFixed(1)),
      },
    });
  } catch (e: any) {
    if (e?.name === "AbortError") return res.status(504).json({ error: "Le modèle met trop de temps à répondre. Essayez une question plus courte." });
    res.status(503).json({ error: "Ollama est injoignable. Est-il démarré ?" });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, () => console.log(`IA du Collège (API) : http://localhost:${PORT}  → modèle ${MODEL} via ${OLLAMA}`));
