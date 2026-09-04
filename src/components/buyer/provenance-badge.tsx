export function ProvenanceBadge({ actor, updatedAt }: { actor: string; updatedAt?: string }) {
  return (
    <small className="provenance">
      Last set by {actor.toLowerCase()}
      {updatedAt ? (
        <time dateTime={updatedAt}> · {new Date(updatedAt).toLocaleString()}</time>
      ) : null}
    </small>
  );
}
