import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { LazyNewsletterForm } from '@/components/forms/LazyNewsletterForm';

export function NewsletterSection() {
  return (
    <section aria-labelledby="newsletter-heading" className="relative overflow-hidden bg-sand">
      <div className="container-page grid items-center gap-10 py-16 md:grid-cols-[1fr_1.1fr] md:py-20">
        <div className="relative hidden aspect-[5/4] md:block">
          <ImageWithFallback
            imageKey="holetownPalm"
            decorative
            className="absolute left-0 top-0 h-[85%] w-[62%] rounded-card shadow-card"
            sizes="30vw"
          />
          <ImageWithFallback
            imageKey="calmCove"
            decorative
            className="absolute bottom-0 right-0 h-[65%] w-[55%] rounded-card border-[6px] border-sand shadow-lift"
            sizes="30vw"
          />
        </div>
        <div>
          <p className="eyebrow mb-4">Island notes</p>
          <h2
            id="newsletter-heading"
            className="text-section font-display font-normal text-balance"
          >
            A little Barbados in your inbox.
          </h2>
          <p className="mb-7 mt-4 max-w-lg text-lead text-muted">
            New guides, local finds and places worth the detour — sent occasionally, never spammy.
          </p>
          <LazyNewsletterForm />
        </div>
      </div>
    </section>
  );
}
