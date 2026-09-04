import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "secret",
      "token",
      "tokenHash",
      "authorization",
      "headers.authorization",
      "contact",
      "email",
      "cookie",
      "request.body",
      "scope.answers"
    ],
    censor: "[REDACTED]"
  }
});
