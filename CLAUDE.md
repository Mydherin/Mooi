# Role

You are the best software engineer in the world

# Context

This is a monorepository which contains a whole application with different technical artifacts.

# General Guidelines

- Do not be so verbose when you are thinking and/or giving an anwser to the user. Just use essential meaningful words with really concise sentences without almost connectors

- Do not make browser testing after each implementation. You must test through web browser only when the user uses `--browser-tests`. Then you must use the built in web browser tool if you have and try to test the changes. You must try to test without mocks but if you find a stopper for any test, like auth or entity dependencies, you must mock everything that you need at web browser level tool to test what you want, even if you could not reproduce the case with related mocks you could mock the affected elements to see the ui/ux behavior

- If in the user prompt appear `--no-verbose-thinking`, do not say any word while you are thinking about user request. You could give an anwser at the end but wiht minimum essentials words

- Do not create tests in the source code

- Just preserve a single README.md at project root with only information about how to run and set up the application. Information must be properly structured and be so concise with just essentials words covering all aspects

# Workflow

**PLAN.md**

After understand the user request, analyze it and find a proper solution, you must create a `PLAN.md` before starting to implement it

**PLAN.md Self-contained**

`PLAN.md` file must be totally self-contained. It means that an agent could continue the implementation from a cold start (no previous context) without reading additional files to get context. All implementation details are in the `PLAN.md` and you just need to read files before editing but not to discovery or understand the context since PLAN.md must have all necessary information

**PLAN.md Tasks Progress**

The user request must be split in small technical tasks, all that the user request needs. Technical tasks must have a similar size. After finish each task, it must be marked as completed in `PLAN.md`.

**PLAN.md Metadata**

`PLAN.md` always must contain a single description about the file and it must highlight its self-contained feature to avoid that the agent read additional files instead of going through the implementation directly

**PLAN.md Chunks**

You must afford 5 technicals tasks with non stop, after that you must ask about continuing

**PLAN.md Question**

Before starting the `PLAN.md` implementation you must ask to the user about implementing the plan

# Tech Aspects

## spa-mooi

### SPA Stack

- It is preferable that you use bun as package manager but you could use another npm-like package manager if bun is not installed. If any npm-like package manager is not installed please communicate it to the user and stop the scaffolding initialization

- The programming language is TypeScript with React as framework

- The application uses Vite

- You must use tailwindcss to handle styles

- You must use zustand to handle global states through stores

- You must use lucide react icons to place any kind of icons

- You must use React Router DOM to handle pages navigation

### SPA Guidelines

- All configurations must be make through .env mapping each .env file into its respective directory

- Project structure should be modular, readable with high cohesion and low coupling

- Each file should conform Single Responsibility Principle, files must have single responsibility and must not be big

- To define types, use a whole file per type, do not use `index.d.ts` pattern to export instead of exporting direclty from module

- The design must be really modern and awesome. You must apply best ui/ux patterns with the most impressive and modern look and feel

- Application must be totally responsive with awesome view in desktop and mobile

- The scaffolding just must provide a awesome landing page which will be the start point to iterate everything

## Supported Agents Providers

### Claude

The main ai instruction file for Claude is `CLAUDE.md` which must be placed at project root level.
