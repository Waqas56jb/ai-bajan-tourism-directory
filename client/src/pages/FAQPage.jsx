import { useLocation } from 'react-router-dom';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { faqGroups, faqs } from '@/data/faq';
import { Seo } from '@/lib/seo';
import { faqJsonLd } from '@/lib/structuredData';
import { useUI } from '@/hooks/useUI';
import { PageHeader } from '@/components/layout/PageContainer';
import { Button } from '@/components/common/Button';

/** Radix Accordion: keyboard support (Enter/Space, arrow keys), aria-expanded/controls built in. */
export default function FAQPage() {
  const { hash } = useLocation();
  const { openChat } = useUI();
  const initiallyOpen = hash ? [hash.slice(1)] : [];

  return (
    <>
      <Seo
        title="Frequently Asked Questions"
        description="How AI Bajan works: finding businesses, the AI assistant, listings, sponsored placements and more."
        path="/faq"
        jsonLd={faqJsonLd(faqs)}
      />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'FAQ' }]}
        eyebrow="Help"
        title="Frequently asked questions"
        description="How the directory, the assistant and listings work."
      />
      <div className="container-page grid gap-12 pb-24 lg:grid-cols-[1fr_320px]">
        <div className="space-y-12">
          {faqGroups.map((group) => (
            <section key={group.title} aria-labelledby={`faq-${group.title}`}>
              <h2 id={`faq-${group.title}`} className="mb-4 font-display text-3xl font-normal">
                {group.title}
              </h2>
              <Accordion.Root
                type="multiple"
                defaultValue={initiallyOpen}
                className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white"
              >
                {group.items.map((item) => (
                  <Accordion.Item
                    key={item.id}
                    value={item.id}
                    id={item.id}
                    className="scroll-mt-28"
                  >
                    <Accordion.Header asChild>
                      <h3>
                        <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-lg font-bold text-navy transition-colors hover:bg-sand/60 sm:px-6">
                          {item.question}
                          <ChevronDown
                            className="h-5 w-5 shrink-0 text-ocean-700 transition-transform duration-300 group-data-[state=open]:rotate-180"
                            aria-hidden="true"
                          />
                        </Accordion.Trigger>
                      </h3>
                    </Accordion.Header>
                    <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_220ms_ease-out] data-[state=open]:animate-[accordion-down_260ms_ease-out]">
                      <p className="px-5 pb-6 text-[1.02rem] leading-relaxed text-ink/80 sm:px-6">
                        {item.answer}
                      </p>
                    </Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion.Root>
            </section>
          ))}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card bg-navy p-6 text-white">
            <h2 className="text-xl font-extrabold text-white">Still have a question?</h2>
            <p className="mt-2 text-white/75">Ask the assistant, or send us a message.</p>
            <div className="mt-5 grid gap-2">
              <Button
                variant="coral"
                onClick={() => openChat()}
                iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
              >
                Ask AI Bajan
              </Button>
              <Button variant="glass" to="/contact">
                Contact us
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
