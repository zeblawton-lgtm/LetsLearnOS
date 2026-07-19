import { spawn } from "node:child_process";
import { copyFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(projectRoot, "dist");
const vinextBin = join(projectRoot, "node_modules", "vinext", "dist", "cli.js");

await rm(outputDirectory, { force: true, recursive: true });

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [vinextBin, "build"], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error("Vinext build exited with code " + code));
  });
});

const serverDirectory = join(outputDirectory, "server");
const workerEntry = join(serverDirectory, "index.js");
await rename(workerEntry, join(serverDirectory, "vinext-handler.js"));
await copyFile(join(projectRoot, "scripts", "sites-worker.mjs"), workerEntry);
await stat(workerEntry);
await mkdir(join(outputDirectory, ".openai"), { recursive: true });
await copyFile(
  join(projectRoot, ".openai", "hosting.json"),
  join(outputDirectory, ".openai", "hosting.json"),
);
