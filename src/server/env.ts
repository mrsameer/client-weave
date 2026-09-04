import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  SCOPE_CAPABILITY_PEPPER: z.string().min(32),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional()
});

export type Environment = z.infer<typeof envSchema>;

export function getEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return envSchema.parse(source);
}
