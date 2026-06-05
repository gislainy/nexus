import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.test");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Auth secrets the server requires to boot. Defaulted here so the suite is
// hermetic: it runs without a local .env.test and without per-step CI env.
// DATABASE_URL is intentionally not defaulted — integration tests need a real
// database connection string supplied by the environment.
process.env.JWT_SECRET ??= "test-secret";
process.env.SERVICE_API_KEY ??= "test-service-key";
