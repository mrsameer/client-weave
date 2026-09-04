import type { Metadata } from "next";
import { connection } from "next/server";
import { AppProviders } from "@/components/shared/app-providers";
import { WebMcpRegistration } from "@/components/shared/webmcp-registration";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "ClientWeave",
  description: "A shared, attributable service-scoping workspace"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="en">
      <body>
        <AppProviders>
          <WebMcpRegistration />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
