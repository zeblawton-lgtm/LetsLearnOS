# LetsLearnMoreOS (LLM OS)

Adult-facing public showcase for LetsLearnOS with an isolated, deterministic
game preview. It is separate from the kiosk and contains no chat, accounts,
forms, analytics, persistent visitor storage, or API credentials.

## Run locally

From the repository root:

    pnpm install
    pnpm --filter @workspace/letslearnos-showcase dev

The production build uses Next.js static export, inlines the presentation CSS,
and packages a dependency-free worker entrypoint for ChatGPT Sites. The public
overview ships no client-side JavaScript; the demo ships one audited inline
script whose state lives only in memory and resets on refresh.

The ChatGPT Sites project identifier is stored in .openai/hosting.json. Runtime secrets must be configured in Sites and never committed; this static showcase does not require any.
