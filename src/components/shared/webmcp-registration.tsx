"use client";

import { useEffect } from "react";
import { browserWebMcpTools, type BrowserWebMcpTool } from "@/webmcp/browser-tools";

type ModelContext = {
  registerTool: (
    tool: BrowserWebMcpTool,
    options?: { signal?: AbortSignal }
  ) => void | Promise<void>;
};

/** Registers the audited capability adapters with browsers that expose WebMCP. */
export function WebMcpRegistration() {
  useEffect(() => {
    const documentContext = (document as Document & { modelContext?: ModelContext }).modelContext;
    const navigatorContext = (navigator as Navigator & { modelContext?: ModelContext })
      .modelContext;
    const context = documentContext ?? navigatorContext;
    if (!context) return;
    const controller = new AbortController();
    for (const tool of browserWebMcpTools)
      void Promise.resolve(context.registerTool(tool, { signal: controller.signal }));
    return () => controller.abort();
  }, []);
  return null;
}
