import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  })
}));

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: mocks.createServerClient
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { refreshOwnerSession, signIn, signOut } from "@/app/owner/auth/actions";

describe("owner session actions", () => {
  const auth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockResolvedValue({ auth });
  });

  it("redirects a successful owner sign-in to services and rejects bad credentials", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    const form = new FormData();
    form.set("email", "owner@example.test");
    form.set("password", "correct horse battery staple");
    await expect(signIn(form)).rejects.toThrow("redirect:/owner/services");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: "correct horse battery staple"
    });

    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "invalid" } });
    await expect(signIn(form)).rejects.toThrow("redirect:/owner/login?error=invalid-credentials");
  });

  it("ends the session and reports refresh success only for a replacement session", async () => {
    auth.signOut.mockResolvedValueOnce({ error: null });
    await expect(signOut()).rejects.toThrow("redirect:/owner/login");
    expect(auth.signOut).toHaveBeenCalledOnce();

    auth.refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: "new" } },
      error: null
    });
    await expect(refreshOwnerSession()).resolves.toEqual({ refreshed: true });
    auth.refreshSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(refreshOwnerSession()).resolves.toEqual({ refreshed: false });
    auth.refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "expired" }
    });
    await expect(refreshOwnerSession()).resolves.toEqual({ refreshed: false });
  });
});
