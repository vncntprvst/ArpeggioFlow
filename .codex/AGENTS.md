# AGENTS.md

## 🎯 Purpose  
This file guides OpenAI Codex (and similar AI agents) to work effectively within this repository by specifying structure, conventions, workflows, testing, and output expectations. AGENTS.md files are read hierarchically—root-level rules apply globally, and deeper nested AGENTS.md files override parent ones :contentReference[oaicite:0]{index=0}.

---

## 📁 Project Structure  
/
├── src/
│ ├── arpeggio.ts # Generates arpeggio note sequences (per chord/shape)
│ ├── shapes.ts # CAGED shape definitions (A, B, C, etc.)
│ ├── progression.ts # Maps chord progressions to chord tones/arpeggios
│ ├── output.ts # Renders single-line music staff (PNG/SVG/ASCII)
│ └── agents/ (optional) # Optional sub-agent logic with its own AGENTS.md
├── test/ # Unit tests for modules
├── README.md # User-facing documentation
├── AGENTS.md # This guidance file
└── package.json # Scripts & dependencies


---

## 🧩 Coding Conventions  
- **Language**: TypeScript  
- **Formatting**: Prettier (`npm run format`)  
- **Linting**: ESLint (`npm run lint`)  
- **Naming**: `camelCase` for functions/vars, `PascalCase` for types/interfaces  
- **Modularity**: Each function should have a single responsibility  
- **Documentation**: Add JSDoc comments for all public/exported APIs  
- **Commits/PRs**: Provide clear messages, reference tests, pass lint/tests

---

## 🔁 Agent Workflow  
When Codex operates in this repo, it should:  
1. Read all applicable AGENTS.md files (root & nested) :contentReference[oaicite:1]{index=1}  
2. Analyze code structure under `/src` and `/test`  
3. Execute natural language prompts (e.g. “Generate ii–V–I lick”)  
4. Generate or modify code respecting style, project conventions, and modularity  
5. Run the full test suite and linters (`npm test`, `npm run lint`, `npm run format`)  
6. Render output via `output.ts` (music staff without TAB)  
7. Include terminal logs or test output in commit or PR

---

## ✅ Testing Procedures  
Agent must verify all changes by running:  
```bash
npm install          # install dependencies  
npm run format       # format code  
npm run lint         # lint code  
npm test             # run unit tests  

All checks should pass before commit or PR.

## 📝 Prompt–Response Guidelines

When presented with a prompt like:

    “Generate a 4-bar ii–V–I lick in D major using CAGED shape A”

The agent should:

    Identify chord progression: Em7 → A7 → Dmaj7 → Dmaj7

    Use shapes.ts and arpeggio.ts to compute arpeggio notes

    Apply ascending/descending logic with smooth between-chord transitions

    Produce a one-line staff via output.ts (PNG/SVG or ASCII)

    Add or update unit tests verifying note sequences and shape usage

## 🛠 Subdirectory Overrides

For feature-specific behaviors or alternate logic, create a nested AGENTS.md under that folder. Rules in nested files override root-level instructions

## 📐 Pull Request Guidelines

When auto-generating PRs, the agent should:

    Include a descriptive summary of changes

    List related tests that were added or updated

    Confirm successful runs of tests and lint checks

    Keep PR focused and code modular with proper documentation

