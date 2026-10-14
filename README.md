# P2 — Parle à l'IA du Collège

Chat avec un LLM **local** (Ollama) + zone « Tester les limites » (hallucinations, biais, raisonnement).

**Stack :** React + Vite + Tailwind • Node + Express • Ollama (llama3.2:3b) • Docker Compose

## Lancer
Option A — Ollama installé sur Windows (recommandé, utilise le GPU) :
```bash
ollama pull llama3.2:3b
cd server && npm install && npm run dev     # :4002
cd client && npm install && npm run dev     # :5172
```
Option B — tout dans Docker :
```bash
docker compose up --build -d
docker compose exec ollama ollama pull llama3.2:3b   # une seule fois (~2 Go)
# http://localhost:5172
```
Changer de modèle : variable `OLLAMA_MODEL` (ex. `qwen2.5:3b`, `gemma2:2b`).

## Architecture
`Navigateur ──POST /chat──▶ Express ──POST /api/chat──▶ Ollama (modèle en mémoire)`

- `/chat` valide l'entrée (≤ 20 messages, ≤ 1000 car.), ajoute un *prompt système*, appelle Ollama avec un délai maximum, renvoie `{reply, stats}`.
- Erreurs distinguées : 400 (entrée), 502 (modèle absent), 503 (Ollama arrêté), 504 (trop long). Le client affiche un message clair et « Réessayer ».
- `/health` alimente le voyant « modèle prêt ».
- **Aucune conversation n'est enregistrée** ni journalisée.

## Démo pour les portes ouvertes
1. « Qui a remporté le Nobel de physique en 2031 ? » → réponse assurée : hallucination.
2. « Combien de r dans programmation ? » → erreurs : elle manipule des tokens, pas des lettres.
3. Biais : comparer les descriptions infirmière / pilote.
4. Encadré « Sobriété numérique » (tokens, secondes).
5. Débrancher le réseau : ça marche encore → *local = privé*.

## Questions pour les étudiants
- Local vs API infonuagique : coûts, latence, vie privée, qualité ?
- Pourquoi `stream: false` ici ? Comment passer au streaming (SSE) ?
- Comment réduire les hallucinations (RAG, consignes, température) ?
- Quels risques d'injection de prompt dans ce `/chat` ?

## Pistes d'extension
Streaming SSE, RAG sur une FAQ du Collège (pgvector), comparaison de deux modèles côte à côte.
