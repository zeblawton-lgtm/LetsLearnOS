import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(projectRoot, "dist");
const exportDirectory = join(projectRoot, "out");
const nextBin = join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

await rm(outputDirectory, { force: true, recursive: true });
await rm(exportDirectory, { force: true, recursive: true });

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [nextBin, "build"], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error("Next.js build exited with code " + code));
  });
});

await rename(exportDirectory, outputDirectory);

const htmlPath = join(outputDirectory, "index.html");
let document = await readFile(htmlPath, "utf8");
const stylesheetPattern =
  /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi;
const stylesheets = [...document.matchAll(stylesheetPattern)];

for (const stylesheet of stylesheets) {
  const href = stylesheet[1];
  if (!href.startsWith("/")) {
    throw new Error(`Cannot inline non-local stylesheet: ${href}`);
  }

  const stylesheetPath = join(outputDirectory, href.split("?")[0].slice(1));
  const css = await readFile(stylesheetPath, "utf8");
  document = document.replace(stylesheet[0], `<style>${css}</style>`);
}

document = document
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(
    /<link\b(?=[^>]*\brel=["'](?:modulepreload|preload)["'])(?=[^>]*\bas=["']script["'])[^>]*>/gi,
    "",
  )
  .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, "");

if (
  /<script\b/i.test(document) ||
  /<link\b[^>]*\brel=["']stylesheet["']/i.test(document) ||
  document.includes("/_next/")
) {
  throw new Error(
    "Static showcase still contains a runtime script or external asset",
  );
}

await writeFile(htmlPath, document);

const serverDirectory = join(outputDirectory, "server");
await mkdir(serverDirectory, { recursive: true });

const icon = await readFile(join(projectRoot, "app", "icon.svg"), "utf8");
const workerSource = `const DOCUMENT = ${JSON.stringify(document)};
const ICON = ${JSON.stringify(icon)};

const securityHeaders = {
  "cache-control": "public, max-age=300",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

function responseFor(request, body, init) {
  return new Response(request.method === "HEAD" ? null : body, init);
}

export default {
  fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const { pathname } = new URL(request.url);

    if (pathname === "/" || pathname === "/index.html") {
      return responseFor(request, DOCUMENT, {
        status: 200,
        headers: { ...securityHeaders, "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/icon.svg" || pathname === "/favicon.ico") {
      return responseFor(request, ICON, {
        status: 200,
        headers: {
          "cache-control": "public, max-age=86400",
          "content-type": "image/svg+xml; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (pathname === "/robots.txt") {
      return responseFor(request, "User-agent: *\\nAllow: /\\n", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return responseFor(request, "Not found", {
      status: 404,
      headers: { ...securityHeaders, "content-type": "text/plain; charset=utf-8" },
    });
  },
};
`;

const workerEntry = join(serverDirectory, "index.js");
await writeFile(workerEntry, workerSource);
await stat(workerEntry);
await mkdir(join(outputDirectory, ".openai"), { recursive: true });
await copyFile(
  join(projectRoot, ".openai", "hosting.json"),
  join(outputDirectory, ".openai", "hosting.json"),
);
