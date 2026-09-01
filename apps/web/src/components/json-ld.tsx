/**
 * Structured data.
 *
 * `JSON.stringify` output is escaped so a headline containing `</script>`
 * cannot break out of the tag — the one real injection risk in a JSON-LD
 * block, and a live one on a news site where headlines quote arbitrary text.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\u003c');

  return (
    <script
      type="application/ld+json"
      // Safe: the payload is our own object, serialised and escaped above.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
