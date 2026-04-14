# Worldview OS

Worldview OS is an internal experimental product and workflow prototype.

It was built to test how far a tailored personal workflow can go versus simply using frontier LLMs directly. The project explores whether a narrow, structured system can create value through saved analyses, comparison, follow-up context, and outcome tracking rather than trying to compete with general-purpose models on raw breadth.

This repository should be read as a trial product, not a polished application.

## What This Repo Is

Worldview OS is a structured analytical memory and tracking experiment. It takes a question, reshapes it into a fixed analysis format, saves the result, and lets the user revisit or compare analyses later.

The core idea was not "build a better general chatbot." The core idea was "see whether a customized system built around one person's analytical workflow can be more useful than asking Claude, GPT, or Gemini directly every time."

## What It Currently Does

- structured analysis generation
- saved analysis history
- comparison view for prior analyses
- scoped follow-ups within analysis context
- manual outcome review workflow
- experimental BTC live-data pilot foundation

## What It Is Not

- not a production-ready app
- not a frontier-model competitor
- not a general-purpose research agent
- not broadly robust across all question types
- not a polished or fully hardened product

## Current Limitations

- The question scope is narrow.
- Output quality is still sensitive to question shape.
- Some validation and retry behavior is brittle on compound or entity-heavy prompts.
- Live-data support is very limited and incomplete.
- Some workflows remain experimental rather than fully reliable.
- Strong frontier LLMs will often outperform this project on one-off questions.
- The repo is best understood as an internal prototype exploring structured memory, comparison, and tracking.

## Why It Exists

This repo exists to test a practical question:

Can a tailored system built around a personal analytical workflow create value beyond just using frontier LLMs directly?

The answer from the experiment so far is mixed but useful:

- There are real strengths in saved memory, comparison, continuity, and review.
- There are also clear limits in robustness, scope, and question fit.

That is why the project is more interesting as a workflow experiment than as a standalone product claim.

## Status

Current status: experimental checkpoint / internal prototype.

The repo is not under active broad product expansion right now unless that work is explicitly resumed later.

## Safe Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Add your own local keys to `.env`.

4. Create the local SQLite database and Prisma client:

```bash
npm run db:push
npm run prisma:generate
```

5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Use placeholders only. Never commit real secrets.

```env
LLM_API_KEY=your_llm_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
KIMI_API_KEY=your_kimi_api_key_here
KIMI_BASE_URL=https://api.moonshot.ai/v1
DATABASE_URL="file:./dev.db"
MOCK_ANALYSIS_MODE=false
```

Notes:

- `DATABASE_URL="file:./dev.db"` is intended for local SQLite development.
- `.env` must stay local and should never be committed.
- If no live key is configured, the app can run in mock mode for local testing.

## Local Development Notes

- This repo is set up for local experimentation, not production deployment.
- Prisma uses SQLite by default for simplicity.
- The BTC live-data path is experimental and very limited in scope.
- Saved local databases may contain personal working state and should not be pushed.

## Repo Hygiene

Before pushing anywhere:

- do not commit `.env`
- do not commit API keys or tokens
- do not commit local SQLite databases with personal data
- do not assume artifact folders are sanitized unless checked
