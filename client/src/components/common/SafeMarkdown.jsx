import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { classifyHref } from '@/lib/safeUrl';

/**
 * Markdown renderer for content we don't fully control (chat replies, CMS text).
 * - Raw HTML in the source is dropped (`skipHtml`) — never executed.
 * - Images are not rendered.
 * - Links are validated: internal paths use the router; external links must be http(s),
 *   mailto or tel and open safely; anything else renders as plain text.
 */
const ALLOWED = [
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'code',
  'br',
  'h2',
  'h3',
  'del',
];

function SafeLink({ href, children }) {
  const target = classifyHref(href);
  if (!target) return <span>{children}</span>;
  if (target.kind === 'internal') return <Link to={target.href}>{children}</Link>;
  return (
    <a href={target.href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

export function SafeMarkdown({ children, className = '' }) {
  return (
    <div className={className}>
      <ReactMarkdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{ a: SafeLink }}
      >
        {String(children ?? '')}
      </ReactMarkdown>
    </div>
  );
}
