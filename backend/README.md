# automata_visualizer_groq

Backend for the **Automata Visualizer & Studio** — converts natural language descriptions of formal languages into DFA / NFA diagrams using the Groq Llama 3.3 70B model for regex extraction and locally compiled Thompson → Subset Construction → Hopcroft minimization.

## Tech Stack
- **Runtime**: Node.js + TypeScript (Express)
- **AI**: Groq API (`llama-3.3-70b-versatile`) for regex extraction
- **Algorithms**: Thompson's Construction, Subset Construction, Hopcroft Minimization
- **Supports**: DFA, NFA, PDA (via CFG), Turing Machine

## Setup

```bash
npm install
cp .env.example .env   # fill in your GROQ_API_KEY
npm run dev            # ts-node-dev hot reload
npm run build          # compile to dist/
npm start              # run compiled output
```

## Environment Variables

```
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3001
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/generate` | Generate automaton from regex / natural language / CFG / JSON |
| POST | `/api/simulate` | Simulate automaton on an input string |
| GET  | `/api/health`   | Health check |

## Deployment on Render

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Add `GROQ_API_KEY`, `GROQ_MODEL`, `PORT` in Render's Environment tab
