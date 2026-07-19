import { spawn } from "node:child_process";
import { rm, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

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

const outputDirectory = join(projectRoot, "dist");
await rm(outputDirectory, { force: true, recursive: true });
await rename(join(projectRoot, "out"), outputDirectory);
