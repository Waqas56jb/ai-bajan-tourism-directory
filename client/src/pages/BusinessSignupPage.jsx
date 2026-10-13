import { forwardRef, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Plus, Store, GraduationCap, Trash2 } from 'lucide-react';
import { Seo } from '@/lib/seo';
import { routes } from '@/lib/routes';
import { getSignupOptions, submitApplication } from '@/lib/services';
import { PageHeader } from '@/components/layout/PageContainer';
import { TextField, SelectField } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';
import { INFO_EXAMPLE, PLANS } from '@/data/forBusiness';

const url = z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), 'Enter a full link starting with https://');
const phone = z.string().trim().max(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number, e.g. +1 246 555 0100');
const lines = (v) => v.split(/\s*\n\s*/).map((s) => s.trim()).filter(Boolean);
const linkList = z.string().max(3000).refine((v) => lines(v).every((l) => /^https?:\/\/\S+\.\S+/i.test(l)), 'Put one full https:// link per line');
const mustConfirm = z.literal(true, { errorMap: () => ({ message: 'Please confirm to continue' }) });
const contactFields = {
  contactName: z.string().trim().min(2, 'Enter the authorised contact person').max(120),
  contactRole: z.string().trim().max(80),
  contactEmail: z.string().trim().email('Enter a valid email address').max(200),
  contactPhone: phone,
};

const businessSchema = z.object({
  plan: z.enum(PLANS.map((p) => p.value)),
  registeredName: z.string().trim().min(2, 'Enter the registered name').max(160),
  tradingName: z.string().trim().max(160),
  categoryId: z.string(),
  categoryOther: z.string().trim().max(80),
  description: z.string().trim().min(20, 'Describe the business (at least 20 characters)').max(2000),
  productsServices: z.string().trim().min(3, 'List your main products or services').max(2000),
  address: z.string().trim().max(300),
  locationId: z.string(),
  mapUrl: url,
  phone,
  whatsapp: phone,
  email: z.union([z.string().trim().email('Enter a valid email address').max(200), z.literal('')]),
  website: url,
  socialLinks: linkList,
  openingHours: z.string().trim().max(500),
  areasServed: z.string().trim().max(500),
  priceRange: z.string().trim().max(200),
  bookingPaymentDelivery: z.string().trim().max(1000),
  faqs: z.array(z.object({ question: z.string().trim().min(5, 'Add the question').max(300), answer: z.string().trim().min(2, 'Add the answer').max(2000) })).max(10),
  mediaLinks: linkList,
  registrationNumber: z.string().trim().max(80),
  licenceNumber: z.string().trim().max(80),
  ...contactFields,
  consentToUse: mustConfirm,
  infoAccurate: mustConfirm,
}).refine((v) => v.phone || v.whatsapp || v.email || v.website, { message: 'Add at least one way for customers to contact you', path: ['phone'] });

const contributorSchema = z.object({
  organisationName: z.string().trim().min(2, 'Enter your organisation or name').max(160),
  contributorType: z.enum(['expert', 'university', 'government', 'cultural', 'other']),
  expertise: z.string().trim().min(10, 'Describe the topics you can contribute').max(1000),
  website: url,
  sampleSources: linkList,
  qualifications: z.string().trim().min(3, 'Add your qualifications').max(1000),
  publicationNotes: z.string().trim().max(1000),
  correctionsEmail: z.string().trim().email('Enter a valid email address').max(200),
  ...contactFields,
  copyrightPermission: mustConfirm,
  consentToUse: mustConfirm,
});

function Section({ title, children, hint }) {
  return (
    <fieldset className="rounded-card bg-white p-5 shadow-soft ring-1 ring-line/70 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <h2 className="font-display text-2xl text-navy">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const Check = forwardRef(function Check({ label, error, ...rest }, ref) {
  return (
    <div className="sm:col-span-2">
      <label className="flex items-start gap-3 text-navy">
        <input ref={ref} type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#13A6A0]" {...rest} />
        <span>{label}</span>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
});

function Done({ kind, demo }) {
  return (
    <div className="container-page pb-24">
      <div role="status" className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-soft ring-1 ring-line/70">
        <CheckCircle2 className="mx-auto h-12 w-12 text-ocean" aria-hidden="true" />
        <h2 className="mt-4 font-display text-3xl text-navy">{demo ? 'Demo: application not sent' : 'Thank you — application received'}</h2>
        <p className="mt-3 text-muted">
          {demo
            ? 'Demo mode: your application passed validation but was not sent.'
            : kind === 'business'
              ? 'The AI Bajan team will review your details, confirm your membership option and contact you. Your listing goes live only after review.'
              : 'The AI Bajan team will review your application and contact you about contributing.'}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button to={routes.home()} variant="primary">Back to home</Button>
          <Button to={routes.forBusiness()} variant="outline">About the programme</Button>
        </div>
      </div>
    </div>
  );
}

function BusinessForm({ options, initialPlan, onDone }) {
  const [error, setError] = useState('');
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      plan: PLANS.some((p) => p.value === initialPlan) ? initialPlan : 'free',
      registeredName: '', tradingName: '', categoryId: '', categoryOther: '', description: '', productsServices: '',
      address: '', locationId: '', mapUrl: '', phone: '', whatsapp: '', email: '', website: '', socialLinks: '',
      openingHours: '', areasServed: '', priceRange: '', bookingPaymentDelivery: '', faqs: [], mediaLinks: '',
      registrationNumber: '', licenceNumber: '', contactName: '', contactRole: '', contactEmail: '', contactPhone: '',
      consentToUse: false, infoAccurate: false,
    },
  });
  const faqs = useFieldArray({ control, name: 'faqs' });
  const e = (k) => errors[k]?.message;

  const submit = async (v) => {
    setError('');
    try {
      const isUuid = (x) => /^[0-9a-f-]{36}$/i.test(x);
      const res = await submitApplication({
        ...v,
        kind: 'business',
        categoryId: isUuid(v.categoryId) ? v.categoryId : undefined,
        locationId: isUuid(v.locationId) ? v.locationId : undefined,
        socialLinks: lines(v.socialLinks),
        mediaLinks: lines(v.mediaLinks),
      });
      onDone(Boolean(res?.demo));
    } catch (err) {
      setError(err?.message || 'Your application could not be sent. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      <Section title="Membership option">
        <SelectField className="sm:col-span-2" label="Plan" options={PLANS.map((p) => ({ value: p.value, label: `${p.name} — ${p.summary}` }))} error={e('plan')} {...register('plan')} />
      </Section>

      <Section title="About the business" hint={INFO_EXAMPLE}>
        <TextField label="Registered name *" error={e('registeredName')} {...register('registeredName')} />
        <TextField label="Trading name (if different)" error={e('tradingName')} {...register('tradingName')} />
        <SelectField label="Business category" placeholder="Choose a category" options={options.categories.map((c) => ({ value: c.id, label: c.name }))} error={e('categoryId')} {...register('categoryId')} />
        <TextField label="Other / more specific type" hint="e.g. Tyre repair, Law firm" error={e('categoryOther')} {...register('categoryOther')} />
        <TextField className="sm:col-span-2" multiline rows={4} label="Description *" error={e('description')} {...register('description')} />
        <TextField className="sm:col-span-2" multiline rows={3} label="Products and services *" hint="List exactly what you offer — this is what customers ask about." error={e('productsServices')} {...register('productsServices')} />
      </Section>

      <Section title="Location and contact">
        <TextField label="Address" error={e('address')} {...register('address')} />
        <SelectField label="Parish / town" placeholder="Choose a location" options={options.locations.filter((l) => l.type !== 'country').map((l) => ({ value: l.id, label: l.name }))} error={e('locationId')} {...register('locationId')} />
        <TextField className="sm:col-span-2" label="Map location link" placeholder="https://maps.google.com/…" error={e('mapUrl')} {...register('mapUrl')} />
        <TextField label="Telephone" type="tel" error={e('phone')} {...register('phone')} />
        <TextField label="WhatsApp" type="tel" error={e('whatsapp')} {...register('whatsapp')} />
        <TextField label="Email" type="email" error={e('email')} {...register('email')} />
        <TextField label="Website" placeholder="https://" error={e('website')} {...register('website')} />
        <TextField className="sm:col-span-2" multiline rows={2} label="Social media links (one per line)" error={e('socialLinks')} {...register('socialLinks')} />
      </Section>

      <Section title="Hours, prices and arrangements">
        <TextField label="Opening hours" placeholder="Mon–Fri 8am–5pm, Sat 9am–1pm" error={e('openingHours')} {...register('openingHours')} />
        <TextField label="Areas served" placeholder="e.g. Christ Church and St. Philip" error={e('areasServed')} {...register('areasServed')} />
        <TextField label="Prices or typical price range" error={e('priceRange')} {...register('priceRange')} />
        <TextField label="Booking, payment and delivery" error={e('bookingPaymentDelivery')} {...register('bookingPaymentDelivery')} />
      </Section>

      <fieldset className="rounded-card bg-white p-5 shadow-soft ring-1 ring-line/70 sm:p-7">
        <legend className="sr-only">Frequently asked questions</legend>
        <h2 className="font-display text-2xl text-navy">Frequently asked questions</h2>
        <p className="mt-1 text-sm text-muted">Questions customers often ask you, with your answers.</p>
        <div className="mt-5 space-y-4">
          {faqs.fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-2xl bg-cream p-4 sm:grid-cols-[1fr_1fr_auto]">
              <TextField label={`Question ${i + 1}`} error={errors.faqs?.[i]?.question?.message} {...register(`faqs.${i}.question`)} />
              <TextField label="Answer" error={errors.faqs?.[i]?.answer?.message} {...register(`faqs.${i}.answer`)} />
              <button type="button" onClick={() => faqs.remove(i)} className="self-end rounded-full p-2 text-muted hover:text-coral-600" aria-label={`Remove question ${i + 1}`}>
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {faqs.fields.length < 10 && (
            <Button type="button" variant="outline" iconLeft={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => faqs.append({ question: '', answer: '' })}>
              Add a question
            </Button>
          )}
        </div>
      </fieldset>

      <Section title="Photos, menus and documents">
        <TextField className="sm:col-span-2" multiline rows={3} label="Links to photographs, menus, brochures or service lists (one per line)" error={e('mediaLinks')} {...register('mediaLinks')} />
      </Section>

      <Section title="Verification and authorised contact" hint="Used only by the AI Bajan team to verify the business — never shown publicly.">
        <TextField label="Company registration number" error={e('registrationNumber')} {...register('registrationNumber')} />
        <TextField label="Professional licence (if applicable)" error={e('licenceNumber')} {...register('licenceNumber')} />
        <TextField label="Authorised contact person *" error={e('contactName')} {...register('contactName')} />
        <TextField label="Role / position" error={e('contactRole')} {...register('contactRole')} />
        <TextField label="Contact email *" type="email" error={e('contactEmail')} {...register('contactEmail')} />
        <TextField label="Contact phone" type="tel" error={e('contactPhone')} {...register('contactPhone')} />
        <Check label="I give AI Bajan permission to use and publish this information." error={e('consentToUse')} {...register('consentToUse')} />
        <Check label="I confirm this information is accurate as of today’s date, and I am authorised to provide it." error={e('infoAccurate')} {...register('infoAccurate')} />
      </Section>

      {error && <p role="alert" className="rounded-2xl border border-coral/40 bg-coral/10 p-4 text-navy">{error}</p>}
      <Button type="submit" size="lg" variant="coral" loading={isSubmitting}>Submit business application</Button>
    </form>
  );
}

function ContributorForm({ onDone }) {
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contributorSchema),
    defaultValues: {
      organisationName: '', contributorType: 'expert', expertise: '', website: '', sampleSources: '', qualifications: '',
      publicationNotes: '', correctionsEmail: '', contactName: '', contactRole: '', contactEmail: '', contactPhone: '',
      copyrightPermission: false, consentToUse: false,
    },
  });
  const e = (k) => errors[k]?.message;
  const submit = async (v) => {
    setError('');
    try {
      const res = await submitApplication({ ...v, kind: 'content_provider', sampleSources: lines(v.sampleSources) });
      onDone(Boolean(res?.demo));
    } catch (err) {
      setError(err?.message || 'Your application could not be sent. Please try again.');
    }
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      <Section title="About you or your organisation">
        <TextField label="Organisation or name *" error={e('organisationName')} {...register('organisationName')} />
        <SelectField
          label="Contributor type"
          options={[
            { value: 'expert', label: 'Expert / specialist' },
            { value: 'university', label: 'University or school' },
            { value: 'government', label: 'Government agency' },
            { value: 'cultural', label: 'Cultural organisation' },
            { value: 'other', label: 'Other' },
          ]}
          {...register('contributorType')}
        />
        <TextField className="sm:col-span-2" multiline rows={3} label="Topics you can contribute *" error={e('expertise')} {...register('expertise')} />
        <TextField label="Website" placeholder="https://" error={e('website')} {...register('website')} />
        <TextField label="Email for corrections *" type="email" error={e('correctionsEmail')} {...register('correctionsEmail')} />
        <TextField className="sm:col-span-2" multiline rows={2} label="Qualifications *" error={e('qualifications')} {...register('qualifications')} />
        <TextField className="sm:col-span-2" multiline rows={3} label="Sources or publications (one link per line)" error={e('sampleSources')} {...register('sampleSources')} />
        <TextField className="sm:col-span-2" multiline rows={2} label="Publication dates and notes" error={e('publicationNotes')} {...register('publicationNotes')} />
      </Section>
      <Section title="Contact and permissions">
        <TextField label="Contact person *" error={e('contactName')} {...register('contactName')} />
        <TextField label="Role / position" error={e('contactRole')} {...register('contactRole')} />
        <TextField label="Contact email *" type="email" error={e('contactEmail')} {...register('contactEmail')} />
        <TextField label="Contact phone" type="tel" error={e('contactPhone')} {...register('contactPhone')} />
        <Check label="I hold the copyright, or have permission, for the material I will provide." error={e('copyrightPermission')} {...register('copyrightPermission')} />
        <Check label="I give AI Bajan permission to use this material in its answers, with credit." error={e('consentToUse')} {...register('consentToUse')} />
      </Section>
      {error && <p role="alert" className="rounded-2xl border border-coral/40 bg-coral/10 p-4 text-navy">{error}</p>}
      <Button type="submit" size="lg" variant="coral" loading={isSubmitting}>Submit contributor application</Button>
    </form>
  );
}

export default function BusinessSignupPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('type') === 'content_provider' ? 'content_provider' : 'business';
  const [done, setDone] = useState(null);
  const options = useQuery({ queryKey: ['signup-options'], queryFn: getSignupOptions, staleTime: 5 * 60_000 });
  const opts = useMemo(() => options.data ?? { categories: [], locations: [] }, [options.data]);

  return (
    <>
      <Seo path="/for-business/apply" title="Sign up — AI Bajan for businesses" description="Apply to list your business or become a verified content provider on AI Bajan." />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'For businesses', to: routes.forBusiness() }, { label: 'Sign up' }]}
        eyebrow="Sign up"
        title={kind === 'business' ? 'List your business on AI Bajan' : 'Become a content provider'}
        description={
          <>
            Not sure what’s involved? <Link to={routes.forBusiness()} className="font-semibold text-ocean-700 underline">Read about the programme first</Link>.
          </>
        }
      >
        {!done && (
          <div className="mt-6 inline-flex rounded-full bg-white p-1 ring-1 ring-line" role="tablist" aria-label="Application type">
            {[
              { k: 'business', label: 'Business', icon: Store },
              { k: 'content_provider', label: 'Content provider', icon: GraduationCap },
            ].map(({ k, label, icon: Icon }) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setParams(k === 'business' ? {} : { type: k }, { replace: true })}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${kind === k ? 'bg-navy text-white' : 'text-navy hover:bg-cream'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>
      {done ? (
        <Done kind={done.kind} demo={done.demo} />
      ) : (
        <div className="container-page max-w-4xl pb-24">
          {kind === 'business' ? (
            <BusinessForm options={opts} initialPlan={params.get('plan')} onDone={(demo) => setDone({ kind, demo })} />
          ) : (
            <ContributorForm onDone={(demo) => setDone({ kind, demo })} />
          )}
        </div>
      )}
    </>
  );
}
