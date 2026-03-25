# AZ-900 Quiz

460 questions from Ditectrev. Instant local grading. Optional AI recap via Anthropic API.

## Local dev

```bash
npm install
npm run dev
```

## Deploy to Vercel

```bash
npm install -g vercel
vercel deploy
```

Then in Vercel dashboard → Project → Settings → Environment Variables:

```
ANTHROPIC_API_KEY = sk-ant-...
```

The AI recap button in the session recap screen calls `/api/recap`. If the env var is not set, the button returns an error message — the rest of the quiz works fine without it.

## Stack

- Vite + React 18
- Zero runtime dependencies beyond React
- Vercel serverless function for optional AI recap (Haiku)
- Questions: Ditectrev AZ-900 repo (460 Q, v1.3.1)
