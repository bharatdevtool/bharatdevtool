# .agents — Project Context Directory

This directory is the **single source of truth** for any AI agent, developer, or tool that needs to understand the Bharat Dev Tools project.

## Directory Structure

```
.agents/
├── README.md              ← You are here. Start here.
├── PROJECT.md             ← Project overview, stack, goals
├── arch/
│   ├── overview.md        ← High-level architecture diagram & explanation
│   ├── nextjs-structure.md← Next.js app structure & routing
│   └── data-flow.md       ← Data flow: state, analytics, theming
├── flows/
│   ├── tool-page-flow.md  ← How a tool page works end-to-end
│   ├── theme-flow.md      ← Theme system (dark/light) flow
│   └── analytics-flow.md  ← Analytics event tracking flow
└── decisions/
    ├── adr-001-nextjs.md  ← Why Next.js (ADR)
    ├── adr-002-tailwind.md← Why Tailwind CSS (ADR)
    └── adr-003-dry.md     ← DRY patterns & shared component strategy
```

## Quick Agent Onboarding

1. Read **PROJECT.md** for the full project overview
2. Read **arch/overview.md** for the system architecture
3. Read **arch/nextjs-structure.md** for file/folder layout
4. Use `graphify-out/GRAPH_REPORT.md` for live code-graph analysis

## Key Facts

- **Domain:** https://bharatdevtool.com
- **Branch:** `nextjs-migration` (Next.js rewrite from HTML/CSS)
- **Main branch:** `main` (original HTML/CSS source)
- **20 tools** across 7 categories
- **Stack:** Next.js 15 (App Router), Tailwind CSS v4, TypeScript
- **Analytics:** GA4 (`G-H00TEVH9KG`)
- **Error tracking:** Sentry
- **Logo CDN:** ImageKit (`https://ik.imagekit.io/bdt/`)

