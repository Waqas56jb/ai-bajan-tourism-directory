import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CheckCircle2, HelpCircle, Megaphone, Store } from 'lucide-react';
import { contactSchema, contactTopics } from '@/lib/validation';
import { submitContactForm } from '@/lib/services';
import { IS_DEMO } from '@/lib/config';
import { Seo } from '@/lib/seo';
import { PageHeader } from '@/components/layout/PageContainer';
import { TextField, SelectField } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';
import { DemoNotice } from '@/components/common/DemoNotice';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

const TOPIC_VALUES = contactTopics.map((t) => t.value);

export default function ContactPage() {
  const [params] = useSearchParams();
  const initialTopic = TOPIC_VALUES.includes(params.get('topic')) ? params.get('topic') : 'general';
  const [result, setResult] = useState(null); // { kind: 'demo'|'sent'|'error', message }

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', topic: initialTopic, subject: '', message: '' },
  });

  const onSubmit = async (values) => {
    setResult(null);
    try {
      const res = await submitContactForm(values);
      reset({ name: '', email: '', topic: values.topic, subject: '', message: '' });
      if (res?.demo) {
        setResult({
          kind: 'demo',
          message:
            'Demo mode: your message passed validation but was not sent — no email service is connected yet.',
        });
        toast.info('Demo mode — message not sent');
      } else {
        setResult({
          kind: 'sent',
          message: 'Thanks — your message has been received. We’ll reply by email.',
        });
        toast.success('Message sent');
      }
    } catch (error) {
      setResult({
        kind: 'error',
        message: error?.message || 'Your message couldn’t be sent. Please try again.',
      });
    }
  };

  const onInvalid = (errs) => {
    const first = ['name', 'email', 'topic', 'subject', 'message'].find((k) => errs[k]);
    if (first) setFocus(first);
  };

  return (
    <>
      <Seo
        title="Contact AI Bajan"
        description="Get in touch with AI Bajan about listings, advertising, partnerships or technical issues."
        path="/contact"
      />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
        eyebrow="Contact"
        title="Let’s talk Barbados"
        description="Questions, corrections, listing requests or partnership ideas — send us a note and the AI Bajan team will follow up."
      />

      <div className="container-page grid gap-12 pb-24 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <aside className="space-y-5">
          {[
            {
              icon: Store,
              title: 'List your business',
              text: 'Choose “Business listing” and tell us about your business, area and category.',
            },
            {
              icon: Megaphone,
              title: 'Advertising',
              text: 'Ask about featured and sponsored placements. All paid placements are clearly labelled.',
            },
            {
              icon: HelpCircle,
              title: 'Report a correction',
              text: 'Spotted something wrong in a listing? Include the business name and what needs fixing.',
            },
          ].map(({ icon: I, title, text }) => (
            <div key={title} className="flex gap-4 rounded-card bg-white p-5 shadow-soft">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ocean/10 text-ocean-700">
                <I className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-extrabold">{title}</h2>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
          <ImageWithFallback
            imageKey="palmBeachBoat"
            aspect="aspect-[16/10]"
            className="hidden rounded-card lg:block"
            sizes="35vw"
          />
          <p className="text-sm text-muted">
            Have a quick question? The{' '}
            <Link to="/faq" className="font-bold text-ocean-700 underline">
              FAQ
            </Link>{' '}
            may already have the answer.
          </p>
        </aside>

        <div className="rounded-[1.75rem] bg-white p-6 shadow-card sm:p-10">
          <h2 className="text-2xl font-extrabold">Send a message</h2>
          <p className="mt-1 text-sm text-muted">All fields are required.</p>
          {IS_DEMO && (
            <DemoNotice className="mt-5">
              This form is a frontend demo. It validates your message but doesn’t send it anywhere
              yet.
            </DemoNotice>
          )}

          <form
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            noValidate
            className="mt-7 grid gap-5"
            aria-describedby="contact-result"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Name"
                autoComplete="name"
                error={errors.name?.message}
                {...register('name')}
              />
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
            <SelectField
              label="Inquiry type"
              options={contactTopics}
              error={errors.topic?.message}
              {...register('topic')}
            />
            <TextField label="Subject" error={errors.subject?.message} {...register('subject')} />
            <TextField
              label="Message"
              multiline
              rows={6}
              error={errors.message?.message}
              hint="Please don’t include passwords or payment details."
              {...register('message')}
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" size="lg" loading={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send message'}
              </Button>
              <p className="text-xs text-muted">
                See our{' '}
                <Link to="/privacy" className="underline">
                  privacy policy
                </Link>{' '}
                (draft).
              </p>
            </div>
            <div id="contact-result" role="status" aria-live="polite">
              {result && (
                <p
                  className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                    result.kind === 'error'
                      ? 'bg-coral/15 text-[#9d2f25]'
                      : 'bg-ocean/10 text-ocean-700'
                  }`}
                  role={result.kind === 'error' ? 'alert' : undefined}
                >
                  {result.kind !== 'error' && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {result.message}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
