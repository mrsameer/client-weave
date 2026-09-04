import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnvironment } from "@/server/env";

export function createRuntimeDatabase(connectionString = getEnvironment().DATABASE_URL) {
  return drizzle(postgres(connectionString, { max: 10, prepare: false }));
}

export function createMigrationClient(connectionString = getEnvironment().DIRECT_DATABASE_URL) {
  return postgres(connectionString, { max: 1, prepare: false });
}
