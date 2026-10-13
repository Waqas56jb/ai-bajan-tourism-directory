import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  GraduationCap,
  Images,
  Inbox,
  Link2,
  MapPin,
  PenLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Seo } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { Button } from '@/components/common/Button';
import { HeroBackdrop } from '@/components/home/HeroBackdrop';
import {
  BUSINESS_BENEFITS,
  CONTRIBUTOR_BENEFITS,
  CONTRIBUTOR_REQUIREMENTS,
  INFO_EXAMPLE,
  INFO_REQUIRED,
  MAIN_PROMISE,
  PLANS,
  PRINCIPLES,
} from '@/data/forBusiness';

const ICONS = { BadgeCheck, Sparkles, MapPin, Link: Link2, Images, Inbox, PenLine, BarChart3, TrendingUp, ShieldCheck };

/**
 * Everything a business (or content provider) should know BEFORE signing up: what AI Bajan offers,
 * what information is needed, membership options and the rules that keep answers trustworthy.
 */
export default function ForBusinessPage() {
  return (
    <>
      <Seo
        path="/for-business"
        title="List your business on AI Bajan"
        description="Become a verified local information partner. AI Bajan connects your business with people actively searching for its services."
      />

      <section aria-labelledby="fb-title" className="relative isolate overflow-hidden">
        <HeroBackdrop />
        <div className="container-page pb-16 md:pb-24" style={{ paddingTop: 'calc(var(--chrome-h, 88px) + 3.5rem)' }}>
          <p className="mb-5 flex items-center gap-4 text-xs font-extrabold uppercase tracking-[0.22em] text-lagoon sm:text-sm">
            <span className="h-px w-10 bg-lagoon" aria-hidden="true" />
            For businesses &amp; organisations
          </p>
          <h1 id="fb-title" className="max-w-3xl font-display text-[2.6rem] leading-[1.05] text-white sm:text-[3.75rem]">
            Become a verified <em className="italic text-lagoon">local information partner.</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/85">{MAIN_PROMISE}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button to={routes.businessSignup('business')} variant="coral" size="lg" iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
              Sign up your business
            </Button>
            <Button to={routes.businessSignup('content_provider')} variant="glass" size="lg">
              Become a content provider
            </Button>
          </div>
          <p className="mt-5 text-sm text-white/70">Please read what’s involved below before you sign up.</p>
        </div>
      </section>

      <section aria-labelledby="fb-offers" className="container-page py-16 md:py-20">
        <p className="eyebrow mb-3">What AI Bajan offers businesses</p>
        <h2 id="fb-offers" className="max-w-3xl font-display text-section text-navy">Businesses that register become verified local information partners</h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_BENEFITS.map((b) => {
            const Icon = ICONS[b.icon] ?? Sparkles;
            return (
              <li key={b.title} className="rounded-card bg-white p-5 shadow-soft ring-1 ring-line/70">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ocean/10 text-ocean-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-bold text-navy">{b.title}</h3>
                <p className="mt-1 text-sm text-muted">{b.text}</p>
              </li>
            );
          })}
        </ul>
        <ul className="mt-8 grid gap-2 rounded-card bg-sand/40 p-5 text-sm text-navy" aria-label="Our principles">
          {PRINCIPLES.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fb-info" className="bg-white py-16 md:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow mb-3">Information businesses provide</p>
            <h2 id="fb-info" className="font-display text-section text-navy">What you’ll need to sign up</h2>
            <p className="mt-4 text-muted">
              The more specific your information, the better AI Bajan can match you with people looking for what you offer.
            </p>
            <p className="mt-6 rounded-2xl border-l-4 border-coral bg-cream p-4 text-navy">{INFO_EXAMPLE}</p>
          </div>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {INFO_REQUIRED.map((i) => (
              <li key={i} className="flex items-start gap-2 text-navy">
                <Check className="mt-1 h-4 w-4 shrink-0 text-ocean" aria-hidden="true" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="fb-plans" className="container-page py-16 md:py-20">
        <p className="eyebrow mb-3">Membership options</p>
        <h2 id="fb-plans" className="font-display text-section text-navy">Choose how you want to be listed</h2>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {PLANS.map((p) => (
            <li
              key={p.value}
              className={`flex flex-col rounded-card p-5 ring-1 ${p.highlight ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-line/80'}`}
            >
              <h3 className="font-display text-2xl">{p.name}</h3>
              <p className={`mt-2 flex-1 text-sm ${p.highlight ? 'text-white/80' : 'text-muted'}`}>{p.summary}</p>
              <Link
                to={`${routes.businessSignup('business')}&plan=${p.value}`}
                className={`mt-5 inline-flex items-center gap-1 text-sm font-bold ${p.highlight ? 'text-lagoon' : 'text-ocean-700'} hover:underline`}
              >
                Choose {p.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">Pricing for paid plans is confirmed by the AI Bajan team after your application is reviewed.</p>
      </section>

      <section aria-labelledby="fb-contrib" className="bg-navy py-16 text-white md:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow eyebrow-light mb-3">Content providers</p>
            <h2 id="fb-contrib" className="font-display text-section">Experts, universities, government agencies and cultural organisations</h2>
            <p className="mt-4 text-white/75">Become a verified contributor and help AI Bajan give better answers about Barbados.</p>
            <Button to={routes.businessSignup('content_provider')} variant="coral" size="lg" className="mt-7" iconLeft={<GraduationCap className="h-5 w-5" aria-hidden="true" />}>
              Apply as a content provider
            </Button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-bold text-lagoon">You may receive</h3>
              <ul className="mt-3 space-y-2 text-white/85">
                {CONTRIBUTOR_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-lagoon" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lagoon">You must provide</h3>
              <ul className="mt-3 space-y-2 text-white/85">
                {CONTRIBUTOR_REQUIREMENTS.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-lagoon" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 text-center md:py-20">
        <h2 className="mx-auto max-w-2xl font-display text-section text-navy">{MAIN_PROMISE}</h2>
        <Button to={routes.businessSignup('business')} variant="primary" size="lg" className="mt-8">
          Start your sign-up
        </Button>
      </section>
    </>
  );
}
