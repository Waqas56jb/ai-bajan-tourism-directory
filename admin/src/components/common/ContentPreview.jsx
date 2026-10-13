/**
 * Minimal, safe renderer for knowledge content: "## " headings, "- " bullets, **bold** and
 * paragraphs. Builds React elements only — raw HTML in the text is shown as text, never executed.
 */
function inline(text, keyBase) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function ContentPreview({ content, className = '' }) {
  const blocks = [];
  let list = null;
  String(content ?? '')
    .split('\n')
    .forEach((raw, i) => {
      const line = raw.trimEnd();
      if (line.startsWith('- ')) {
        if (!list) {
          list = [];
          blocks.push({ type: 'ul', items: list, key: `ul-${i}` });
        }
        list.push(line.slice(2));
        return;
      }
      list = null;
      if (!line.trim()) return;
      if (line.startsWith('## ')) blocks.push({ type: 'h', text: line.slice(3), key: `h-${i}` });
      else blocks.push({ type: 'p', text: line, key: `p-${i}` });
    });

  if (!blocks.length) return <p className={`text-sm italic text-muted ${className}`}>No content yet.</p>;

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-muted ${className}`}>
      {blocks.map((b) =>
        b.type === 'h' ? (
          <h3 key={b.key} className="pt-1 text-[0.95rem] font-semibold text-ink">
            {inline(b.text, b.key)}
          </h3>
        ) : b.type === 'ul' ? (
          <ul key={b.key} className="list-disc space-y-1 pl-5 marker:text-accent">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `${b.key}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={b.key}>{inline(b.text, b.key)}</p>
        ),
      )}
    </div>
  );
}
