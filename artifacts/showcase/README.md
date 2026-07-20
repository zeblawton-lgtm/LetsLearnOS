# LetsLearnOS Playbook

Adult-facing public showcase for LetsLearnOS. It is intentionally separate from the child learning interface and contains no chat, accounts, forms, analytics, storage, or API credentials.

## Run locally

From the repository root:

    pnpm install
    pnpm --filter @workspace/letslearnos-showcase dev

The production build uses Next.js static export, inlines the presentation CSS,
and packages a dependency-free worker entrypoint for ChatGPT Sites. The public
page does not ship client-side JavaScript.

The ChatGPT Sites project identifier is stored in .openai/hosting.json. Runtime secrets must be configured in Sites and never committed; this static showcase does not require any.
