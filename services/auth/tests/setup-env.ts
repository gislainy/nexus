import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.test");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
