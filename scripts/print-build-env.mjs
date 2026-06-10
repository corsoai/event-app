import { cpus, totalmem } from "node:os";
import { execFileSync } from "node:child_process";

function readNpmVersion() {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const match = userAgent.match(/npm\/([^\s]+)/);
    if (match) return match[1];
  }

  try {
    return execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const npmVersion = readNpmVersion();
const memoryMb = Math.round(totalmem() / 1024 / 1024);

console.log(`Build environment: node=${process.version} npm=${npmVersion} cpus=${cpus().length} memory=${memoryMb}MB`);
