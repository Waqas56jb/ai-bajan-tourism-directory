import { lazy, Suspense } from 'react';

// The form pulls in react-hook-form + zod; it sits below the fold on every page, so it is
// loaded on demand to keep the initial bundle small.
const NewsletterForm = lazy(() => import('./NewsletterForm'));

export function LazyNewsletterForm(props) {
  return (
    <Suspense
      fallback={<div className={props.compact ? 'h-[104px]' : 'h-[120px]'} aria-hidden="true" />}
    >
      <NewsletterForm {...props} />
    </Suspense>
  );
}
