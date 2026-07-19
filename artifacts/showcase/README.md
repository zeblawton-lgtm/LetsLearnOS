# LetsLearnOS Playbook

Adult-facing public showcase for LetsLearnOS. It is intentionally separate from the child learning interface and contains no chat, accounts, forms, analytics, storage, or API credentials.

## Run locally

From the repository root:

    pnpm install
    pnpm --filter @workspace/letslearnos-showcase dev

The production build uses Vinext to package the Next.js interface for the
ChatGPT Sites runtime in dist/.

The ChatGPT Sites project identifier is stored in .openai/hosting.json. Runtime secrets must be configured in Sites and never committed; this static showcase does not require any.
