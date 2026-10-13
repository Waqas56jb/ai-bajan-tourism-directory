import { ArrowRight, Mail } from 'lucide-react';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Button } from '@/components/common/Button';
import { Reveal } from '@/components/common/Reveal';

export function BusinessOwnerCTA() {
  return (
    <section aria-labelledby="owner-heading" className="container-page pb-[var(--space-section)]">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-navy px-6 py-14 sm:px-12 md:py-20 lg:px-16">
          <ImageWithFallback
            imageKey="beachShack"
            decorative
            className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 md:block"
            sizes="50vw"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/95 to-navy/40"
            aria-hidden="true"
          />
          <svg
            className="absolute -bottom-10 left-0 -z-10 w-[200%] text-ocean/20 animate-wave"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M0 60c100-40 200-40 300 0s200 40 300 0 200-40 300 0 200 40 300 0v60H0z"
            />
          </svg>
          <div className="max-w-xl">
            <p className="eyebrow eyebrow-light mb-4">For businesses</p>
            <h2
              id="owner-heading"
              className="text-section font-display font-normal text-white text-balance"
            >
              Are You a Barbados Business Owner?
            </h2>
            <p className="mt-4 text-lead text-white/80">
              Help travelers discover your business and showcase what makes it special.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                to={routes.forBusiness()}
                variant="coral"
                size="lg"
                iconRight={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
              >
                Explore Listing Options
              </Button>
              <Button
                to={routes.contact()}
                variant="glass"
                size="lg"
                iconLeft={<Mail className="h-5 w-5" aria-hidden="true" />}
              >
                Contact AI Bajan
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
