import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import { categories } from '@/data/categories';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { Button } from '@/components/common/Button';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

export default function NotFoundPage({
  title = 'Page not found',
  message = 'The page you’re looking for has drifted out to sea. Let’s get you back on course.',
}) {
  return (
    <>
      <Seo title={title} noindex path="/404" />
      <section className="container-page grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-4">404</p>
          <h1 className="font-display text-page font-normal">{title}</h1>
          <p className="mt-4 max-w-lg text-lead text-muted">{message}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button to="/" size="lg" iconLeft={<Compass className="h-5 w-5" aria-hidden="true" />}>
              Back to homepage
            </Button>
            <Button to={routes.businesses()} variant="outline" size="lg">
              Explore businesses
            </Button>
          </div>
          <h2 className="mt-12 text-sm font-extrabold uppercase tracking-[0.12em] text-muted">
            Popular categories
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link
                  to={routes.category(c.slug)}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-soft hover:text-ocean-700"
                >
                  {c.shortName} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <ImageWithFallback
          imageKey="calmCove"
          aspect="aspect-[4/3]"
          className="rounded-card shadow-card"
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </section>
    </>
  );
}
