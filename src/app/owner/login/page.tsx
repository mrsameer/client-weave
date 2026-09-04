import { signIn } from "../auth/actions";

export default async function OwnerLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <p className="eyebrow">ClientWeave owner</p>
      <h1>Sign in</h1>
      {error ? <p role="alert">Sign-in failed. Check your credentials and try again.</p> : null}
      <form action={signIn}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
