/**
 * Page metadata via react-helmet-async.
 *
 * Note: this is a client-rendered SPA. Crawlers that execute JavaScript (e.g. Googlebot) will
 * see these tags; many social-preview bots will not. See README → "SEO limitations" for the
 * prerendering plan.
 *
 * Structured data is only emitted from real fields. Demo listings never emit LocalBusiness
 * data, and ratings / reviews / addresses are never fabricated.
 */
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, SITE_URL } from './config';
import { getImage } from './imageSources';

const DEFAULT_DESCRIPTION =
  'Ask Barbados. Get a Bajan answer. AI Bajan answers questions about Barbados — history, culture, food, people, places, businesses, government services and everyday life — with reliable Barbadian sources.';
const DEFAULT_IMAGE = '/images/og-default.jpg';

function absolute(url) {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  imageKey,
  type = 'website',
  noindex = false,
  jsonLd,
}) {
  const fullTitle = title
    ? `${title} · ${SITE_NAME}`
    : `${SITE_NAME} — Discover Barbados, Find Local Gems`;
  const canonical = absolute(path);
  const image = absolute(imageKey ? getImage(imageKey, { width: 1200 }).src : DEFAULT_IMAGE);
  const blocks = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex" />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {blocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
