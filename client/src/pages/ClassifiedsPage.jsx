import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Briefcase, CalendarClock, CheckCircle2, Mail, MapPin, MessageCircle, Phone, Plus, ShoppingBag, X } from 'lucide-react';
import { Seo } from '@/lib/seo';
import { getClassifieds, getSignupOptions, submitClassified } from '@/lib/services';
import { PageHeader } from '@/components/layout/PageContainer';
import { SearchInput, SelectField, TextField } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';
import { useDebounce } from '@/hooks/useDebounce';

const phone = z.string().trim().max(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number');
const schema = z
  .object({
    kind: z.enum(['job', 'classified']),
    title: z.string().trim().min(3, 'Add a title').max(140),
    description: z.string().trim().min(10, 'Add a description (at least 10 characters)').max(4000),
    category: z.string().trim().max(60),
    employer: z.string().trim().max(140),
    employmentType: z.string().trim().max(40),
    salary: z.string().trim().max(80),
    qualifications: z.string().trim().max(1000),
    applyUrl: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\/\S+\.\S+/i.test(v), 'Enter a full link starting with https://'),
    applyDeadline: z.string(),
    price: z.string().trim().max(60),
    itemCondition: z.string().trim().max(40),
    locationId: z.string(),
    area: z.string().trim().max(80),
    contactName: z.string().trim().min(2, 'Add a contact name').max(120),
    contactPhone: phone,
    contactWhatsapp: phone,
    contactEmail: z.union([z.string().trim().email('Enter a valid email address').max(200), z.literal('')]),
    requestedDays: z.string(),
    consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm to continue' }) }),
  })
  .refine((v) => v.contactPhone || v.contactWhatsapp || v.contactEmail || v.applyUrl, { message: 'Add at least one way to contact you', path: ['contactPhone'] })
  .refine((v) => v.kind !== 'job' || v.employer.trim().length >= 2, { message: 'Add the employer', path: ['employer'] });

const fmt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`;
const wa = (n) => `https://wa.me/${n.replace(/\D/g, '')}`;

function AdCard({ ad, highlighted }) {
  const isJob = ad.kind === 'job';
  return (
    <li id={`ad-${ad.id}`} className={`rounded-card bg-white p-5 shadow-soft ring-1 ${highlighted ? 'ring-2 ring-ocean' : 'ring-line/70'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
        <span className={isJob ? 'text-ocean-700' : 'text-coral-600'}>{isJob ? 'Job' : 'For sale / service'}</span>
        {ad.category && <span className="rounded-full bg-cream px-2 py-0.5 text-navy/70">{ad.category}</span>}
      </div>
      <h3 className="mt-2 text-lg font-bold text-navy">{ad.title}</h3>
      {isJob && ad.employer && <p className="text-sm font-semibold text-navy/80">{ad.employer}</p>}
      <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{ad.description}</p>
      <dl className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
        {(ad.area || ad.locationName) && (
          <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-coral-600" aria-hidden="true" />{[ad.area, ad.locationName].filter(Boolean).join(', ')}</div>
        )}
        {isJob && ad.salary && <div><dt className="sr-only">Salary</dt><dd>Pay: {ad.salary}</dd></div>}
        {isJob && ad.employmentType && <div><dd>{ad.employmentType}</dd></div>}
        {!isJob && ad.price && <div><dd className="font-semibold text-navy">Price: {ad.price}</dd></div>}
        {!isJob && ad.itemCondition && <div><dd>Condition: {ad.itemCondition}</dd></div>}
        {isJob && ad.applyDeadline && <div className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" aria-hidden="true" />Apply by {fmt(ad.applyDeadline)}</div>}
      </dl>
      {isJob && ad.qualifications && <p className="mt-2 text-sm text-muted">Requirements: {ad.qualifications}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {ad.applyUrl && /^https?:\/\//.test(ad.applyUrl) && (
          <Button href={ad.applyUrl} size="sm" target="_blank" rel="noopener noreferrer nofollow">How to apply</Button>
        )}
        {ad.contactPhone && (
          <a href={tel(ad.contactPhone)} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-bold text-navy"><Phone className="h-4 w-4" aria-hidden="true" />{ad.contactPhone}</a>
        )}
        {ad.contactWhatsapp && (
          <a href={wa(ad.contactWhatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-bold text-navy"><MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp</a>
        )}
        {ad.contactEmail && (
          <a href={`mailto:${ad.contactEmail}`} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-sm font-bold text-navy"><Mail className="h-4 w-4" aria-hidden="true" />Email</a>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Posted {fmt(ad.createdAt)} · Contact: {ad.contactName}
        {ad.expiresAt ? ` · Listing ends ${fmt(ad.expiresAt)}` : ''}
      </p>
    </li>
  );
}

function PostForm({ kind, onClose, onDone }) {
  const [error, setError] = useState('');
  const options = useQuery({ queryKey: ['signup-options'], queryFn: getSignupOptions, staleTime: 5 * 60_000 });
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      kind, title: '', description: '', category: '', employer: '', employmentType: '', salary: '', qualifications: '', applyUrl: '',
      applyDeadline: '', price: '', itemCondition: '', locationId: '', area: '', contactName: '', contactPhone: '', contactWhatsapp: '',
      contactEmail: '', requestedDays: '30', consent: false,
    },
  });
  const isJob = watch('kind') === 'job';
  const e = (k) => errors[k]?.message;
  const submit = async (v) => {
    setError('');
    try {
      const isUuid = (x) => /^[0-9a-f-]{36}$/i.test(x);
      const res = await submitClassified({
        ...v,
        applyDeadline: v.applyDeadline || undefined,
        locationId: isUuid(v.locationId) ? v.locationId : undefined,
        requestedDays: Number(v.requestedDays) || undefined,
      });
      onDone(Boolean(res?.demo));
    } catch (err) {
      setError(err?.message || 'Your advert could not be sent. Please try again.');
    }
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="rounded-card bg-white p-5 shadow-soft ring-1 ring-line/70 sm:p-7" aria-label="Post an advert">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-navy">Post an advert</h2>
          <p className="mt-1 text-sm text-muted">Every advert is checked by the AI Bajan team before it appears, and it ends automatically on its expiry date.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:text-navy" aria-label="Close the form"><X className="h-5 w-5" aria-hidden="true" /></button>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <SelectField label="Type of advert" options={[{ value: 'job', label: 'Job vacancy' }, { value: 'classified', label: 'Item for sale / service' }]} {...register('kind')} />
        <TextField label="Category" placeholder={isJob ? 'e.g. Hospitality, Construction' : 'e.g. Furniture, Electronics'} error={e('category')} {...register('category')} />
        <TextField className="sm:col-span-2" label="Title *" error={e('title')} {...register('title')} />
        <TextField className="sm:col-span-2" multiline rows={4} label="Description *" error={e('description')} {...register('description')} />
        {isJob ? (
          <>
            <TextField label="Employer *" error={e('employer')} {...register('employer')} />
            <TextField label="Full-time / part-time / contract" error={e('employmentType')} {...register('employmentType')} />
            <TextField label="Pay" error={e('salary')} {...register('salary')} />
            <TextField label="Apply by (date)" type="date" error={e('applyDeadline')} {...register('applyDeadline')} />
            <TextField className="sm:col-span-2" label="Qualifications / requirements" error={e('qualifications')} {...register('qualifications')} />
            <TextField className="sm:col-span-2" label="Application link" placeholder="https://" error={e('applyUrl')} {...register('applyUrl')} />
          </>
        ) : (
          <>
            <TextField label="Price" error={e('price')} {...register('price')} />
            <TextField label="Condition" placeholder="New, used, good…" error={e('itemCondition')} {...register('itemCondition')} />
          </>
        )}
        <SelectField label="Parish / town" placeholder="Choose a location" options={(options.data?.locations ?? []).filter((l) => l.type !== 'country').map((l) => ({ value: l.id, label: l.name }))} {...register('locationId')} />
        <TextField label="Area / district" error={e('area')} {...register('area')} />
        <TextField label="Contact name *" error={e('contactName')} {...register('contactName')} />
        <TextField label="Phone" type="tel" error={e('contactPhone')} {...register('contactPhone')} />
        <TextField label="WhatsApp" type="tel" error={e('contactWhatsapp')} {...register('contactWhatsapp')} />
        <TextField label="Email" type="email" error={e('contactEmail')} {...register('contactEmail')} />
        <SelectField label="Show the advert for" options={[{ value: '14', label: '2 weeks' }, { value: '30', label: '30 days' }, { value: '60', label: '60 days' }]} {...register('requestedDays')} />
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-navy">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#13A6A0]" {...register('consent')} />
            <span>I confirm this advert is genuine, I’m allowed to publish it, and AI Bajan may show it and use it in answers.</span>
          </label>
          {e('consent') && <p className="field-error" role="alert">{e('consent')}</p>}
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-navy">{error}</p>}
      <Button type="submit" variant="coral" size="lg" className="mt-6" loading={isSubmitting}>Submit for review</Button>
    </form>
  );
}

export default function ClassifiedsPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') === 'classified' ? 'classified' : 'job';
  const view = params.get('view');
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(null);
  const list = useQuery({
    queryKey: ['classifieds', view ? 'all' : kind, debounced],
    queryFn: ({ signal }) => getClassifieds(view ? { q: debounced } : { kind, q: debounced }, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.items ?? [];

  useEffect(() => {
    if (view && items.length) document.getElementById(`ad-${view}`)?.scrollIntoView({ block: 'center' });
  }, [view, items.length]);

  return (
    <>
      <Seo path="/classifieds" title="Jobs & Classifieds in Barbados" description="Current job vacancies and items for sale or services in Barbados, checked by the AI Bajan team." />
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Jobs & Classifieds' }]}
        eyebrow="Jobs & Classifieds"
        title="Jobs, items for sale and local services"
        description="Every advert is reviewed before it appears and ends on its expiry date, so what you see here is current."
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line" role="tablist" aria-label="Advert type">
            {[
              ['job', 'Jobs', Briefcase],
              ['classified', 'For sale & services', ShoppingBag],
            ].map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={!view && kind === k}
                onClick={() => setParams(k === 'job' ? {} : { kind: k }, { replace: true })}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${!view && kind === k ? 'bg-navy text-white' : 'text-navy hover:bg-cream'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <Button variant="coral" iconLeft={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => { setPosting(true); setDone(null); }}>
            Post an advert
          </Button>
        </div>
      </PageHeader>

      <div className="container-page max-w-5xl pb-24">
        {done && (
          <div role="status" className="mb-6 flex items-start gap-3 rounded-card bg-white p-5 shadow-soft ring-1 ring-line/70">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-ocean" aria-hidden="true" />
            <p className="text-navy">
              {done === 'demo'
                ? 'Demo mode: your advert passed validation but was not sent.'
                : 'Thank you — your advert has been received. It will appear here once the AI Bajan team has approved it.'}
            </p>
          </div>
        )}
        {posting && (
          <div className="mb-8">
            <PostForm kind={kind} onClose={() => setPosting(false)} onDone={(demo) => { setPosting(false); setDone(demo ? 'demo' : 'sent'); }} />
          </div>
        )}
        <SearchInput value={q} onChange={setQ} onClear={() => setQ('')} label="Search adverts" placeholder={kind === 'job' ? 'Search jobs, e.g. driver, nurse, cashier' : 'Search items and services'} className="mb-6 max-w-xl" />
        {list.isError ? (
          <p role="alert" className="rounded-card bg-coral/10 p-5 text-navy">{list.error?.message || 'Adverts could not be loaded.'}</p>
        ) : list.isPending ? (
          <p className="text-muted">Loading adverts…</p>
        ) : items.length ? (
          <ul className="grid gap-4 md:grid-cols-2" aria-label="Adverts">
            {items.map((ad) => (
              <AdCard key={ad.id} ad={ad} highlighted={ad.id === view} />
            ))}
          </ul>
        ) : (
          <div className="rounded-card bg-white p-8 text-center shadow-soft ring-1 ring-line/70">
            <p className="font-semibold text-navy">{debounced ? 'No adverts match your search.' : kind === 'job' ? 'No job vacancies are listed right now.' : 'No items or services are listed right now.'}</p>
            <p className="mt-1 text-sm text-muted">Have something to post? Adverts appear here once approved.</p>
          </div>
        )}
      </div>
    </>
  );
}
