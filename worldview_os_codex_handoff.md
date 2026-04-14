# worldview_os_codex_handoff.md

## Purpose

This file is the execution brief for Codex to build the first working MVP of **Worldview OS**.

Use this document together with:
- `worldview_os_prd_v2.pdf`
- `worldview_os_wireframe.pdf`
- `worldview_os_technical_build_ticket_breakdown.pdf`

These three files explain the product logic, UX flow, and engineering ticket structure.  
This handoff file removes ambiguity and defines the exact MVP build target.

---

## Build objective

Build a working MVP of **Worldview OS**, a structured intelligence application that accepts a user question and returns a multi-angle analysis rather than a single direct answer.

The MVP must:
1. Accept a user question
2. Reframe and normalize the question
3. Identify relevant domains
4. Expand the question into analytical lenses
5. Generate a scenario matrix
6. Produce a synthesis with indicators and watchlist
7. Save the analysis to history
8. Allow the user to reopen previous analyses

The MVP does **not** need to be production-perfect.  
The goal is a clean, usable, logically correct first version.

---

## Product positioning

Worldview OS is **not** a generic chatbot.

It is a **structured intelligence engine** that helps the user analyze any question through multiple serious lenses:
- political
- geopolitical
- economic
- social
- market
- crypto
- legal
- technological
- behavioral
- historical
- game-theoretic
- narrative
- tail-risk
- domain-specific lenses where relevant

---

## Build scope for MVP

### Include in MVP
- Single-user application
- Ask Question screen
- Domain selection or auto-detection
- Time horizon input
- Objective input
- Analysis generation pipeline
- Reframed question section
- Definitions section
- Relevant domains section
- Lens breakdown section
- Scenario matrix section
- Hidden variables section
- Change-my-mind section
- Bottom-line synthesis section
- Watchlist section
- Save analysis history
- Analysis detail page
- Basic settings page for prompt/model config
- Clean UI
- Local persistence or simple database persistence

### Exclude from MVP
- Multi-user authentication
- Team collaboration
- Real-time news ingestion
- Automated scenario repricing
- Alert engine
- External data connectors
- Portfolio integration
- Sports API integration
- Crypto market API integration
- Admin dashboard
- Role-based access control
- Billing
- Multi-model routing logic beyond a simple abstraction layer
- Full agent marketplace / plugin marketplace

---

## Recommended stack

Use this stack unless there is a strong implementation reason not to:

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui components where useful

### Backend
- Next.js API routes for MVP
- Server-side TypeScript

### Database
- SQLite for local-first MVP
- Prisma ORM

### LLM layer
- OpenAI API
- Simple abstraction layer so models can be swapped later

### Validation
- Zod for schema validation

### State / data fetching
- Native React + server actions or simple fetch pattern
- Avoid unnecessary complexity

### Deployment target
- Local development first
- Architecture should remain easy to deploy later to Vercel

---

## Non-goals

Do not over-engineer the first version.

Avoid:
- microservices
- event-driven architecture
- Kafka
- vector database
- heavy orchestration frameworks
- agent swarm complexity beyond what is required for prompt modularity
- workflow engines
- premature optimization

This MVP should be understandable by one engineer.

---

## UX goals

The app should feel like:
- serious
- analytical
- structured
- not noisy
- easy to scan
- suitable for long-form thinking

The user should feel:
- the system understood the question
- the system expanded the thinking space
- the output is structured and decision-useful
- the answer is not just another essay

---

## Required screens

Implement these screens first.

### 1. Home / Ask Question
Purpose:
- primary input screen

Components:
- question input textarea
- optional domain selector
- optional time horizon field
- optional objective field
- submit button
- recent analyses list

Behavior:
- user submits a question
- app creates analysis job
- app routes to analysis result page

### 2. Analysis Result
Purpose:
- primary output screen

Sections:
- original question
- reframed question
- definitions
- domains
- key drivers
- lens breakdown
- scenario matrix
- hidden variables
- what would change my mind
- bottom line
- watchlist

Behavior:
- sections should render in consistent order
- user can save, edit title, or return home
- allow copy/export as markdown

### 3. History
Purpose:
- list of prior analyses

Components:
- sortable list
- search field
- analysis cards with title, created date, domain tags

Behavior:
- open an existing analysis
- delete an analysis

### 4. Analysis Detail
Purpose:
- full saved record view

Behavior:
- identical structure to result page
- editable title
- optional notes field

### 5. Settings
Purpose:
- lightweight configuration for MVP

Components:
- model field
- system prompt version selector or text area
- temperature field
- max token field
- output schema mode toggle if useful

Behavior:
- save configuration locally

---

## Suggested repo structure

```text
/worldview-os
  /app
    /page.tsx
    /analysis/[id]/page.tsx
    /history/page.tsx
    /settings/page.tsx
    /api/analyze/route.ts
    /api/history/route.ts
  /components
    QuestionForm.tsx
    AnalysisHeader.tsx
    DefinitionsSection.tsx
    DomainsSection.tsx
    LensSection.tsx
    ScenarioMatrix.tsx
    HiddenVariablesSection.tsx
    ChangeMyMindSection.tsx
    BottomLineSection.tsx
    WatchlistSection.tsx
    HistoryList.tsx
  /lib
    prisma.ts
    llm.ts
    analysis.ts
    prompt-builder.ts
    utils.ts
  /prompts
    system.txt
    classifier.txt
    worldview-analysis.txt
    synthesis.txt
  /schemas
    analysis.ts
  /types
    analysis.ts
  /prisma
    schema.prisma
  /docs
    worldview_os_codex_handoff.md
```

Keep the codebase clean and obvious.

---

## Data model

Use a single core analysis model for MVP.

### Prisma model suggestion

```prisma
model Analysis {
  id                  String   @id @default(cuid())
  title               String
  originalQuestion    String
  reframedQuestion    String
  timeHorizon         String?
  objective           String?
  domainsJson         String
  definitionsJson     String
  keyDriversJson      String
  lensesJson          String
  scenariosJson       String
  hiddenVariablesJson String
  changeMyMindJson    String
  bottomLine          String
  watchlistJson       String
  rawResponseJson     String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

For MVP, storing structured JSON as strings is acceptable.

---

## Required output schema

The backend must return a strictly structured JSON object matching this shape.

```json
{
  "title": "",
  "original_question": "",
  "reframed_question": "",
  "time_horizon": "",
  "objective": "",
  "definitions": [
    {
      "term": "",
      "definition": ""
    }
  ],
  "domains": [
    ""
  ],
  "key_drivers": [
    ""
  ],
  "lenses": [
    {
      "name": "",
      "why_it_matters": "",
      "key_drivers": [
        ""
      ],
      "bull_case": "",
      "bear_case": "",
      "base_case": "",
      "wildcard_case": "",
      "evidence_for": [
        ""
      ],
      "evidence_against": [
        ""
      ],
      "leading_indicators": [
        ""
      ],
      "disconfirming_signals": [
        ""
      ]
    }
  ],
  "scenarios": [
    {
      "name": "",
      "description": "",
      "probability": 0,
      "impact": "low | medium | high",
      "time_horizon": "",
      "confidence": "low | medium | high",
      "leading_indicators": [
        ""
      ]
    }
  ],
  "hidden_variables": [
    ""
  ],
  "change_my_mind_conditions": [
    ""
  ],
  "bottom_line": "",
  "watchlist": [
    ""
  ]
}
```

Use Zod to enforce this shape before saving.

---

## Prompt architecture

Keep prompt orchestration simple in MVP.

### Prompt layers
1. system prompt
2. analysis prompt template
3. schema enforcement instruction

### MVP prompt flow
1. receive user question and optional parameters
2. build analysis prompt
3. call LLM once for structured JSON output
4. validate output with Zod
5. save output
6. render UI

### Do not build yet
- multiple agent calls
- parallel committee execution
- red-team subcalls
- separate classifier pass unless really needed

Design the code so multi-step orchestration can be added later.

---

## System prompt guidance

The system prompt should instruct the model to:
- act as a worldview analysis engine
- avoid direct-answer mode
- normalize the question first
- define key terms
- identify applicable domains
- expand into lenses
- generate scenarios
- state hidden variables
- state change-my-mind conditions
- produce a concise synthesis
- return only valid structured JSON

---

## Prompt files to create

### `/prompts/system.txt`
Core worldview behavior, tone, and rules.

### `/prompts/worldview-analysis.txt`
Main analysis instruction template with placeholders:
- user question
- domain
- time horizon
- objective

### Optional for later
- `/prompts/red-team.txt`
- `/prompts/committee-macro.txt`
- `/prompts/committee-politics.txt`
- `/prompts/committee-crypto.txt`

Do not implement the later prompt files in logic yet unless easy.

---

## API contract

### POST `/api/analyze`
Request body:
```json
{
  "question": "Will policy X fail by 2027?",
  "domain": "politics",
  "timeHorizon": "by 2027",
  "objective": "understand key angles and risks"
}
```

Response body:
```json
{
  "id": "analysis_id",
  "analysis": {
    "title": "",
    "original_question": "",
    "reframed_question": "",
    "time_horizon": "",
    "objective": "",
    "definitions": [],
    "domains": [],
    "key_drivers": [],
    "lenses": [],
    "scenarios": [],
    "hidden_variables": [],
    "change_my_mind_conditions": [],
    "bottom_line": "",
    "watchlist": []
  }
}
```

### GET `/api/history`
Returns saved analyses summary list.

### GET `/api/history/:id`
Returns one full analysis.

### DELETE `/api/history/:id`
Deletes one analysis.

---

## Build order

Implement in this sequence.

### Phase 1
- initialize Next.js app
- install Tailwind, Prisma, SQLite, Zod
- create base layout
- create homepage with question form
- create schema and database model

### Phase 2
- create `/api/analyze`
- create LLM client abstraction
- create prompt loader
- create structured JSON validation
- persist analysis record

### Phase 3
- create analysis result page
- build reusable analysis sections
- render all structured fields

### Phase 4
- create history page
- create detail page
- add delete support
- add title editing

### Phase 5
- create settings page
- add local or DB-backed config
- improve validation and error handling

### Phase 6
- polish UI
- add markdown export
- improve loading states
- improve empty/error states

---

## Acceptance criteria for MVP

The MVP is complete when:

1. A user can submit a question from the home screen
2. The app sends the question to the backend
3. The backend calls the LLM and receives structured output
4. The output is validated against schema
5. The result is saved to the database
6. The user is routed to a result page
7. The result page shows:
   - reframed question
   - definitions
   - domains
   - key drivers
   - lens breakdown
   - scenario matrix
   - hidden variables
   - change-my-mind conditions
   - bottom-line synthesis
   - watchlist
8. The user can open prior analyses from history
9. The user can delete an analysis
10. The app works locally with clear setup instructions

---

## Quality bar

The build should prioritize:
- clarity
- correctness
- structure
- maintainability

Do not optimize for flashy UI first.
Do not optimize for AI complexity first.
Do not optimize for theoretical scale first.

The first version must be:
- understandable
- demoable
- extensible

---

## Error handling requirements

Handle these gracefully:
- empty question input
- LLM returns invalid JSON
- LLM returns partial JSON
- database write fails
- history record not found
- API key missing

Use clear user-facing messages.

---

## Nice-to-have, only if easy

Only add these if they do not slow the MVP materially:
- regenerate analysis
- duplicate prior analysis
- export analysis as markdown
- copy structured result
- tag analyses by detected domain

These are optional.

---

## Developer instructions for Codex

When building:
1. Start with the MVP scope only
2. Follow the repo structure unless a small improvement is clearly better
3. Keep the schema strict
4. Keep components modular
5. Prefer simple server-side logic over unnecessary complexity
6. Leave clean comments where future multi-agent expansion should hook in
7. Add a `README.md` with setup instructions
8. Add a `.env.example`
9. Make the app runnable locally

---

## Required environment variables

```env
OPENAI_API_KEY=
DATABASE_URL="file:./dev.db"
```

Add more only if truly necessary.

---

## README requirements

The repo must include a `README.md` with:
- what the project is
- stack used
- setup instructions
- environment variables
- how to run locally
- future roadmap section

---

## Final build instruction to Codex

Build the MVP now.

Do not redesign the product.
Do not widen the scope.
Do not substitute a generic chatbot UX for the structured analysis UX.
Do not omit the schema-driven output structure.
Do not collapse the result into a single prose answer.

The point of the product is structured worldview analysis, not conversational sparkle.

Ship the first clean machine.
