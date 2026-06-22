# Automata Visualizer

An interactive visualizer for DFA, NFA, PDA, and Turing Machines with:
- **Natural Language → Automaton** powered by Claude 3.5 Sonnet
- **Image → Automaton** powered by GPT-4o vision
- **Step-by-step simulation** with animated transitions
- **Regex input** compiled via Thompson/Subset/Hopcroft pipeline

## Setup

### Prerequisites
- Node.js 18+
- Anthropic API key (for NL → DFA/NFA/PDA/TM)
- OpenAI API key (for image scanning)

### Install
```bash
npm install
```

### Configure
Copy `.env.example` to `backend/.env` and fill in your API keys:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Run
```bash
npm run dev
```
Frontend: http://localhost:5173  
Backend:  http://localhost:3001
