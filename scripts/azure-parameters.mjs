import { writeFileSync } from "node:fs";
import { join } from "node:path";

const names = {
  appName: "AZURE_API_APP_NAME", location: "AZURE_LOCATION", supabaseUrl: "SUPABASE_URL",
  supabaseAnonKey: "SUPABASE_ANON_KEY", redisUrl: "UPSTASH_REDIS_REST_URL",
  redisToken: "UPSTASH_REDIS_REST_TOKEN", sessionSecret: "SESSION_SECRET",
};
const parameters = {};
for (const [parameter, name] of Object.entries(names)) {
  if (!process.env[name]) throw new Error(`Missing required configuration: ${name}`);
  parameters[parameter] = { value: process.env[name] };
}
if (!process.env.RUNNER_TEMP) throw new Error("This script runs inside GitHub Actions.");
// Secrets stay in an ephemeral runner file, never CLI arguments or log output.
writeFileSync(join(process.env.RUNNER_TEMP, "carefiji-parameters.json"), JSON.stringify({
  $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  contentVersion: "1.0.0.0", parameters,
}), { mode: 0o600 });
