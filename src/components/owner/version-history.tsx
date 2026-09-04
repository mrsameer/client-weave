type Version = {
  versionId: string;
  version: number;
  name: string;
  ruleSetVersion: number | null;
  createdAt: Date;
  activeVersionId: string | null;
};

export function VersionHistory({ versions }: { versions: Version[] }) {
  return (
    <section>
      <h2>Version history</h2>
      <p>
        Publishing affects future buyer quotes only. Existing quotes retain their original service,
        pricing-rule, and evaluator snapshots.
      </p>
      <ol>
        {versions.map((version) => (
          <li key={version.versionId}>
            Version {version.version}: {version.name}
            {version.versionId === version.activeVersionId ? " (active)" : ""} — rule set{" "}
            {version.ruleSetVersion ?? "unavailable"}; {version.createdAt.toLocaleString()}
          </li>
        ))}
      </ol>
    </section>
  );
}
