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

# Tech Aspects

<leave it blank to be filled in the future>

## Supported Agents Providers

### Claude

The main ai instruction file for Claude is `CLAUDE.md` which must be placed at project root level.
