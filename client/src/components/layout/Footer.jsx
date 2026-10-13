import { Link } from 'react-router-dom';
import { categories } from '@/data/categories';
import { travelGuides } from '@/data/travelGuides';
import { SOCIAL_LINKS } from '@/lib/config';
import { routes } from '@/lib/routes';
import { Logo } from '@/components/common/Logo';
import { LazyNewsletterForm } from '@/components/forms/LazyNewsletterForm';

const socialPaths = {
  instagram:
    'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  facebook:
    'M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.5V21h3z',
  x: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z',
};

function FooterColumn({ title, links }) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-extrabold uppercase tracking-[0.14em] text-lagoon">
        {title}
      </h2>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-[0.95rem] text-white/75 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative bg-navy text-white">
      <svg
        className="pointer-events-none absolute bottom-[calc(100%-1px)] left-0 h-6 w-full text-navy md:h-10"
        viewBox="0 0 1440 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M0 40V26c120-12 240-18 360-16s240 20 360 20 240-16 360-20 240 4 360 16v14z"
        />
      </svg>
      <div className="container-page pb-10 pt-16 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div className="max-w-md">
            <Logo tone="light" />
            <p className="mt-5 text-white/75">
              Barbados’s trusted AI knowledge assistant — clear answers about our history, culture,
              food, places, businesses, government services and everyday life, for Bajans and
              visitors alike.
            </p>
            <div className="mt-8 rounded-card bg-white/5 p-5 ring-1 ring-white/10">
              <p className="mb-3 font-bold">Island notes, now and then</p>
              <LazyNewsletterForm tone="dark" compact />
            </div>
            {SOCIAL_LINKS.length > 0 && (
              <ul className="mt-6 flex gap-2" aria-label="Social media">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`AI Bajan on ${s.label}`}
                      className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-ocean"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-[18px] w-[18px] fill-current"
                        aria-hidden="true"
                      >
                        <path d={socialPaths[s.id]} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:gap-8">
            <FooterColumn
              title="Discover"
              links={[
                { to: '/discover', label: 'Discover Barbados' },
                { to: '/businesses', label: 'Explore businesses' },
                { to: '/places/holetown', label: 'Holetown' },
                { to: '/places/bridgetown', label: 'Bridgetown' },
                { to: '/places/bathsheba', label: 'Bathsheba' },
              ]}
            />
            <FooterColumn
              title="Categories"
              links={categories.map((c) => ({ to: routes.category(c.slug), label: c.shortName }))}
            />
            <FooterColumn
              title="Guides"
              links={[
                { to: '/guides', label: 'All travel guides' },
                ...travelGuides
                  .slice(0, 4)
                  .map((g) => ({ to: routes.guide(g.slug), label: g.title.replace(/^A /, '') })),
              ]}
            />
            <FooterColumn
              title="AI Bajan"
              links={[
                { to: '/about', label: 'About' },
                { to: '/contact', label: 'Contact' },
                { to: routes.forBusiness(), label: 'List your business' },
                { to: '/faq', label: 'FAQ' },
              ]}
            />
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© {year} AI Bajan. Listings marked “Demo” are fictional examples.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link to="/privacy" className="hover:text-white">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-white">
                Terms of service
              </Link>
            </li>
            <li>
              <Link to="/about#photo-credits" className="hover:text-white">
                Photo credits
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
