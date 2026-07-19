import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(projectRoot));
const turbopackRoot = existsSync(join(workspaceRoot, "pnpm-workspace.yaml"))
  ? workspaceRoot
  : projectRoot;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
