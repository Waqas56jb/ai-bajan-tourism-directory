import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, ImagePlus, Lock, Plus, Save, Send, Trash2, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { listingSchema, formToListing } from './listingSchema';
import { isSlugTaken, suggestSlug } from '@/services/listingService';
import { useLookups } from '@/hooks/useLookups';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TextField, TextAreaField, SelectField, CheckboxField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { TagInput } from '@/components/common/TagInput';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/Badge';
import { ImageUploadPreview } from '@/components/common/ImageUploadPreview';
import { DemoNotice } from '@/components/common/States';
import {
  AUDIENCES,
  INDEXING_STATUSES,
  LANGUAGES,
  LISTING_STATUSES,
  LISTING_TYPES,
  PRICE_RANGES,
} from '@/utils/constants';
import { formatDateTime } from '@/utils/formatDate';

const SECTIONS = [
  ['basic', 'Basic information'],
  ['location', 'Location'],
  ['contact', 'Contact'],
  ['details', 'Business details'],
  ['media', 'Media'],
  ['seo', 'Search & SEO'],
  ['ai', 'AI knowledge'],
];

const AMENITY_SUGGESTIONS = [
  'Free Wi-Fi',
  'Parking',
  'Wheelchair accessible',
  'Family-friendly',
  'Outdoor seating',
  'Card payments',
  'Air conditioning',
  'Beachfront',
  'Pool',
  'Vegetarian options',
];

/** What the chatbot would be allowed to read, built only from public, opted-in fields. */
function chatbotKnowledgePreview(values, { categoryName, placeLabel }) {
  if (!values.ai.includeInChatbot) return null;
  const lines = [
    `${values.name || 'Untitled listing'} — ${categoryName(values.categoryId)} in ${placeLabel(values.location)}.`,
  ];
  if (values.ai.includeDescription) {
    if (values.shortDescription) lines.push(values.shortDescription);
    if (values.description) lines.push(values.description);
  }
  if (values.details.openingHours.length)
    lines.push(`Opening hours: ${values.details.openingHours.map((h) => `${h.day} ${h.hours}`).join('; ')}.`);
  if (values.details.amenities.length) lines.push(`Amenities: ${values.details.amenities.join(', ')}.`);
  if (values.details.priceRange) lines.push(`Price range: ${values.details.priceRange}.`);
  if (values.ai.includeContact) {
    const c = values.contact;
    const parts = [
      c.phone && `phone ${c.phone}`,
      c.email && `email ${c.email}`,
      c.website && `website ${c.website}`,
    ].filter(Boolean);
    if (parts.length) lines.push(`Contact: ${parts.join(', ')}.`);
  }
  // Internal notes are never included, regardless of settings.
  return lines.join('\n');
}

/**
 * Create/edit form for listings (sections A–H). Submit buttons set the target status.
 * @param {{ initialValues: object, listingId?: string, onSubmit: (values) => Promise<boolean>, submitting: boolean, onCancel: () => void, mode: 'create'|'edit' }} props
 */
export function ListingForm({ initialValues, listingId, onSubmit, submitting, onCancel, mode }) {
  const lookups = useLookups();
  const { categories, locations } = lookups;
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState(null);
  const fileUrls = useRef([]);

  const form = useForm({
    resolver: zodResolver(listingSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    getValues,
    formState: { errors, isDirty },
  } = form;

  const values = useWatch({ control });
  const hours = useFieldArray({ control, name: 'details.openingHours' });
  const socials = useFieldArray({ control, name: 'contact.socials' });
  const gallery = useFieldArray({ control, name: 'media.gallery' });

  const blocker = useUnsavedChanges(isDirty && !saved);

  // Revoke local preview URLs on unmount
  useEffect(() => () => fileUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Suggest a slug from the name until the admin edits the slug themselves
  const name = values.name;
  useEffect(() => {
    if (!slugTouched && name?.trim()) setValue('slug', suggestSlug(name, listingId), { shouldDirty: true });
  }, [name, slugTouched, setValue, listingId]);

  const regions = locations.filter((l) => l.type === 'region' && l.parentId === values.location?.countryId);
  const cities = locations.filter((l) => l.type === 'city' && l.parentId === values.location?.regionId);
  const neighborhoods = locations.filter(
    (l) => l.type === 'neighborhood' && l.parentId === values.location?.cityId,
  );
  const countries = locations.filter((l) => l.type === 'country');

  const preview = useMemo(
    () => (values.ai ? chatbotKnowledgePreview(values, lookups) : null),
    [values, lookups],
  );

  const submitWith = (status) => (e) => {
    setAction(status);
    return handleSubmit(
      async (data) => {
        if (isSlugTaken(data.slug, listingId)) {
          setError('slug', { message: 'This slug is already used by another listing.' });
          document.getElementById('field-slug')?.focus();
          return;
        }
        let payload = formToListing({ ...data, status });
        const hadLocalFiles = [payload.media.featuredImage, ...payload.media.gallery.map((g) => g.url)].some(
          (u) => u?.startsWith('blob:'),
        );
        if (hadLocalFiles) {
          payload = {
            ...payload,
            media: {
              ...payload.media,
              featuredImage: payload.media.featuredImage.startsWith('blob:')
                ? ''
                : payload.media.featuredImage,
              gallery: payload.media.gallery.filter((g) => !g.url.startsWith('blob:')),
            },
          };
          toast.warning('Local image previews weren’t saved', {
            description: 'Uploads need the backend. Use image URLs in the demo.',
          });
        }
        setSaved(true);
        const ok = await onSubmit(payload);
        if (!ok) setSaved(false); // keep input and allow retry
      },
      (errs) => {
        toast.error('Please fix the highlighted fields', {
          description: `${Object.keys(errs).length} section(s) need attention.`,
        });
        const first = document.querySelector('[aria-invalid="true"]');
        first?.focus();
      },
    )(e);
  };

  const pickLocalImage = (file, onUrl) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) return toast.error('Images must be 5 MB or smaller.');
    const url = URL.createObjectURL(file);
    fileUrls.current.push(url);
    onUrl(url);
  };

  const err = (path) => path.split('.').reduce((o, k) => o?.[k], errors)?.message;

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="min-w-0 space-y-6">
        {/* A. Basic information */}
        <Card id="basic" className="scroll-mt-24">
          <SectionHeader
            step="A"
            title="Basic information"
            description="How the business is named and categorised."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Business name"
              required
              error={err('name')}
              maxLength={120}
              value={values.name}
              className="md:col-span-2"
              {...register('name')}
            />
            <div className="md:col-span-2">
              <TextField
                id="field-slug"
                label="URL slug"
                required
                prefix="/business/"
                error={err('slug')}
                helper={
                  slugTouched ? 'Edited manually.' : 'Generated from the business name. Edit to customise.'
                }
                {...register('slug', { onChange: () => setSlugTouched(true) })}
              />
              {slugTouched && (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline"
                  onClick={() => {
                    setSlugTouched(false);
                    setValue('slug', suggestSlug(getValues('name'), listingId), { shouldDirty: true });
                  }}
                >
                  <Wand2 className="h-3 w-3" aria-hidden="true" /> Regenerate from name
                </button>
              )}
            </div>
            <TextAreaField
              label="Short description"
              required
              rows={2}
              maxLength={160}
              value={values.shortDescription}
              error={err('shortDescription')}
              helper="Shown on cards and search results."
              className="md:col-span-2"
              {...register('shortDescription')}
            />
            <TextAreaField
              label="Full description"
              required
              rows={6}
              maxLength={4000}
              value={values.description}
              error={err('description')}
              className="md:col-span-2"
              {...register('description')}
            />
            <SelectField
              label="Listing type"
              required
              options={LISTING_TYPES}
              error={err('listingType')}
              {...register('listingType')}
            />
            <SelectField
              label="Status"
              options={Object.entries(LISTING_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
              helper="The buttons on the right set the final status."
              {...register('status')}
            />
            <SelectField
              label="Primary category"
              required
              placeholder="Choose a category…"
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.parentId ? '— ' : ''}${c.name}${c.active ? '' : ' (inactive)'}`,
              }))}
              error={err('categoryId')}
              {...register('categoryId')}
            />
            <fieldset className="md:col-span-2">
              <legend className="label">Secondary categories</legend>
              <div className="flex flex-wrap gap-2">
                <Controller
                  control={control}
                  name="secondaryCategoryIds"
                  render={({ field }) =>
                    categories
                      .filter((c) => c.id !== values.categoryId)
                      .map((c) => {
                        const on = field.value.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              field.onChange(
                                on ? field.value.filter((x) => x !== c.id) : [...field.value, c.id],
                              )
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-accent bg-accent/10 text-accent-600' : 'border-line text-muted hover:border-muted/50 hover:text-ink'}`}
                          >
                            {c.name}
                          </button>
                        );
                      })
                  }
                />
              </div>
              {err('secondaryCategoryIds') && <p className="error-text">{err('secondaryCategoryIds')}</p>}
            </fieldset>
          </div>
        </Card>

        {/* B. Location */}
        <Card id="location" className="scroll-mt-24">
          <SectionHeader
            step="B"
            title="Location"
            description="Regions update the available towns. Coordinates are entered manually — no geocoding is performed."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Country"
              required
              options={countries.map((c) => ({ value: c.id, label: c.name }))}
              error={err('location.countryId')}
              {...register('location.countryId', {
                onChange: () => {
                  setValue('location.regionId', '');
                  setValue('location.cityId', '');
                  setValue('location.neighborhoodId', '');
                },
              })}
            />
            <SelectField
              label="Island or region"
              required
              placeholder="Choose a region…"
              options={regions.map((r) => ({ value: r.id, label: r.name }))}
              error={err('location.regionId')}
              {...register('location.regionId', {
                onChange: () => {
                  setValue('location.cityId', '');
                  setValue('location.neighborhoodId', '');
                },
              })}
            />
            <SelectField
              label="City or town"
              required
              placeholder={
                values.location?.regionId
                  ? cities.length
                    ? 'Choose a town…'
                    : 'No towns in this region'
                  : 'Choose a region first'
              }
              disabled={!values.location?.regionId}
              options={cities.map((r) => ({ value: r.id, label: r.name }))}
              error={err('location.cityId')}
              {...register('location.cityId', { onChange: () => setValue('location.neighborhoodId', '') })}
            />
            <SelectField
              label="Neighbourhood or district"
              placeholder={neighborhoods.length ? 'None' : 'No districts for this town'}
              disabled={!neighborhoods.length}
              options={neighborhoods.map((r) => ({ value: r.id, label: r.name }))}
              {...register('location.neighborhoodId')}
            />
            <TextField
              label="Street address"
              className="md:col-span-2"
              error={err('location.address')}
              {...register('location.address')}
            />
            <TextField
              label="Postal code"
              helper="Optional — Barbados postcodes are rarely used."
              {...register('location.postalCode')}
            />
            <SelectField
              label="Public location display"
              options={[
                { value: 'exact', label: 'Show exact address & map pin' },
                { value: 'area', label: 'Show town / area only' },
                { value: 'hidden', label: 'Hide location (contact for details)' },
              ]}
              {...register('location.displayPreference')}
            />
            <TextField
              label="Latitude"
              inputMode="decimal"
              placeholder="13.1866"
              error={err('location.lat')}
              {...register('location.lat')}
            />
            <TextField
              label="Longitude"
              inputMode="decimal"
              placeholder="-59.6375"
              error={err('location.lng')}
              {...register('location.lng')}
            />
          </div>
        </Card>

        {/* C. Contact */}
        <Card id="contact" className="scroll-mt-24">
          <SectionHeader
            step="C"
            title="Contact information"
            description="Only fill in details the business has approved for public display."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Public phone"
              type="tel"
              placeholder="+1 246 555 0100"
              error={err('contact.phone')}
              {...register('contact.phone')}
            />
            <TextField
              label="Email"
              type="email"
              placeholder="hello@business.com"
              error={err('contact.email')}
              {...register('contact.email')}
            />
            <TextField
              label="Website"
              type="url"
              placeholder="https://"
              error={err('contact.website')}
              {...register('contact.website')}
            />
            <TextField
              label="WhatsApp"
              type="tel"
              placeholder="+1 246 555 0100"
              error={err('contact.whatsapp')}
              {...register('contact.whatsapp')}
            />
            <TextField
              label="Booking URL"
              type="url"
              placeholder="https://"
              error={err('contact.bookingUrl')}
              className="md:col-span-2"
              {...register('contact.bookingUrl')}
            />
          </div>
          <fieldset className="mt-5">
            <legend className="label">Social links</legend>
            <ul className="space-y-2">
              {socials.fields.map((f, i) => (
                <li key={f.id} className="grid grid-cols-[1fr_2fr_auto] items-start gap-2">
                  <TextField
                    label={`Platform ${i + 1}`}
                    hideLabel
                    placeholder="Instagram"
                    error={err(`contact.socials.${i}.platform`)}
                    {...register(`contact.socials.${i}.platform`)}
                  />
                  <TextField
                    label={`URL ${i + 1}`}
                    hideLabel
                    placeholder="https://"
                    error={err(`contact.socials.${i}.url`)}
                    {...register(`contact.socials.${i}.url`)}
                  />
                  <IconButton
                    label={`Remove social link ${i + 1}`}
                    icon={Trash2}
                    variant="danger"
                    onClick={() => socials.remove(i)}
                  />
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              className="mt-2"
              onClick={() => socials.append({ platform: '', url: '' })}
              disabled={socials.fields.length >= 6}
            >
              Add social link
            </Button>
          </fieldset>
        </Card>

        {/* D. Business details */}
        <Card id="details" className="scroll-mt-24">
          <SectionHeader step="D" title="Business details" />
          <fieldset>
            <legend className="label">Opening hours</legend>
            {hours.fields.length === 0 && (
              <p className="mb-2 text-xs text-muted">
                No hours listed — the public site and chatbot will say hours aren’t available.
              </p>
            )}
            <ul className="space-y-2">
              {hours.fields.map((f, i) => (
                <li key={f.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                  <TextField
                    label={`Days ${i + 1}`}
                    hideLabel
                    placeholder="Mon – Fri"
                    error={err(`details.openingHours.${i}.day`)}
                    {...register(`details.openingHours.${i}.day`)}
                  />
                  <TextField
                    label={`Hours ${i + 1}`}
                    hideLabel
                    placeholder="09:00 – 17:00"
                    error={err(`details.openingHours.${i}.hours`)}
                    {...register(`details.openingHours.${i}.hours`)}
                  />
                  <IconButton
                    label={`Remove hours row ${i + 1}`}
                    icon={Trash2}
                    variant="danger"
                    onClick={() => hours.remove(i)}
                  />
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              className="mt-2"
              onClick={() => hours.append({ day: '', hours: '' })}
            >
              Add hours
            </Button>
          </fieldset>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Price range"
              placeholder="Not specified"
              options={PRICE_RANGES}
              {...register('details.priceRange')}
            />
            <Controller
              control={control}
              name="details.languages"
              render={({ field }) => (
                <TagInput
                  label="Languages supported"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={LANGUAGES}
                />
              )}
            />
            <div className="md:col-span-2">
              <Controller
                control={control}
                name="details.amenities"
                render={({ field }) => (
                  <TagInput
                    label="Amenities"
                    value={field.value}
                    onChange={field.onChange}
                    suggestions={AMENITY_SUGGESTIONS}
                    helper="Press Enter to add. Click a suggestion to add it."
                  />
                )}
              />
            </div>
            <Controller
              control={control}
              name="details.audiences"
              render={({ field }) => (
                <TagInput
                  label="Suitable audiences"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={AUDIENCES}
                />
              )}
            />
            <TextAreaField
              label="Accessibility information"
              rows={2}
              maxLength={500}
              value={values.details?.accessibility}
              {...register('details.accessibility')}
            />
            <TextAreaField
              label="Booking requirements"
              rows={2}
              maxLength={300}
              value={values.details?.bookingRequirements}
              {...register('details.bookingRequirements')}
            />
            <TextAreaField
              label="Additional public notes"
              rows={2}
              maxLength={500}
              value={values.details?.notes}
              {...register('details.notes')}
            />
            <div className="md:col-span-2">
              <TextAreaField
                label={
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Internal notes (admins only)
                  </span>
                }
                rows={2}
                maxLength={1000}
                value={values.internalNotes}
                helper="Never shown on the public site or used by the chatbot."
                {...register('internalNotes')}
              />
            </div>
          </div>
        </Card>

        {/* E. Media */}
        <Card id="media" className="scroll-mt-24">
          <SectionHeader
            step="E"
            title="Media"
            description="Use image URLs. Choosing a file shows a local preview only — files aren’t uploaded in the demo."
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[240px_1fr]">
            <div>
              {values.media?.featuredImage ? (
                <ImageUploadPreview
                  src={values.media.featuredImage}
                  alt={values.media.featuredAlt}
                  label="featured image"
                  onRemove={() => setValue('media.featuredImage', '', { shouldDirty: true })}
                />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-xs text-muted">
                  <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  No featured image
                </div>
              )}
              {values.media?.featuredImage?.startsWith('blob:') && (
                <p className="mt-1 text-2xs font-medium text-warning">Local preview — not uploaded.</p>
              )}
            </div>
            <div className="space-y-4">
              <TextField
                label="Featured image URL"
                type="url"
                placeholder="https://"
                error={err('media.featuredImage')}
                {...register('media.featuredImage')}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-subtle">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Choose a local file to preview
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    pickLocalImage(e.target.files?.[0], (url) =>
                      setValue('media.featuredImage', url, { shouldDirty: true }),
                    );
                    e.target.value = '';
                  }}
                />
              </label>
              <TextField
                label="Alt text"
                required={Boolean(values.media?.featuredImage)}
                placeholder="Describe the image"
                maxLength={150}
                value={values.media?.featuredAlt}
                error={err('media.featuredAlt')}
                {...register('media.featuredAlt')}
              />
            </div>
          </div>
          <fieldset className="mt-6">
            <legend className="label">Gallery ({gallery.fields.length})</legend>
            {gallery.fields.length > 0 && (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.fields.map((f, i) => (
                  <li key={f.id} className="space-y-2">
                    <ImageUploadPreview
                      src={values.media?.gallery?.[i]?.url}
                      alt={values.media?.gallery?.[i]?.alt}
                      label={`gallery image ${i + 1}`}
                      onRemove={() => gallery.remove(i)}
                    />
                    <TextField
                      label={`Image ${i + 1} URL`}
                      hideLabel
                      placeholder="https://"
                      error={err(`media.gallery.${i}.url`)}
                      {...register(`media.gallery.${i}.url`)}
                    />
                    <TextField
                      label={`Image ${i + 1} alt text`}
                      hideLabel
                      placeholder="Alt text"
                      {...register(`media.gallery.${i}.alt`)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={() => gallery.append({ url: '', alt: '' })}
                disabled={gallery.fields.length >= 12}
              >
                Add image URL
              </Button>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-subtle">
                <Upload className="h-4 w-4" aria-hidden="true" /> Preview local files
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    [...(e.target.files ?? [])]
                      .slice(0, 12 - gallery.fields.length)
                      .forEach((file) => pickLocalImage(file, (url) => gallery.append({ url, alt: '' })));
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </fieldset>
        </Card>

        {/* F. SEO */}
        <Card id="seo" className="scroll-mt-24">
          <SectionHeader step="F" title="Search and SEO" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="SEO title"
              maxLength={70}
              value={values.seo?.title}
              placeholder={values.name ? `${values.name} | AI Bajan` : ''}
              error={err('seo.title')}
              className="md:col-span-2"
              {...register('seo.title')}
            />
            <TextAreaField
              label="Meta description"
              rows={2}
              maxLength={170}
              value={values.seo?.description}
              error={err('seo.description')}
              className="md:col-span-2"
              {...register('seo.description')}
            />
            <Controller
              control={control}
              name="seo.keywords"
              render={({ field }) => (
                <TagInput label="Keywords" value={field.value} onChange={field.onChange} />
              )}
            />
            <TextField
              label="Canonical URL"
              type="url"
              placeholder="https://"
              error={err('seo.canonicalUrl')}
              {...register('seo.canonicalUrl')}
            />
            <Controller
              control={control}
              name="seo.searchVisible"
              render={({ field }) => (
                <Toggle
                  label="Visible in site search"
                  description="Show this listing in directory search results."
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <SelectField
              label="Search-engine indexing"
              options={[
                { value: 'index', label: 'Allow indexing' },
                { value: 'noindex', label: 'Ask search engines not to index' },
              ]}
              {...register('seo.indexing')}
            />
          </div>
          <div
            className="mt-5 rounded-xl border border-line bg-subtle/50 p-4"
            aria-label="Search result preview"
          >
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted">
              Search result preview
            </p>
            <p className="mt-2 truncate text-[0.95rem] font-medium text-info">
              {values.seo?.title || `${values.name || 'Business name'} | AI Bajan`}
            </p>
            <p className="truncate text-xs text-success">
              aibajan.example.com/business/{values.slug || 'slug'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
              {values.seo?.description || values.shortDescription || 'Meta description…'}
            </p>
          </div>
        </Card>

        {/* G. AI knowledge */}
        <Card id="ai" className="scroll-mt-24">
          <SectionHeader
            step="G"
            title="AI knowledge & chatbot visibility"
            description="Controls what the future chatbot may use. Nothing is indexed from this demo."
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Controller
                control={control}
                name="ai.includeInChatbot"
                render={({ field }) => (
                  <Toggle
                    label="Include listing in chatbot knowledge"
                    description="Only published listings are ever used."
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="ai.includeDescription"
                render={({ field }) => (
                  <Toggle
                    label="Include public description in retrieval"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!values.ai?.includeInChatbot}
                  />
                )}
              />
              <Controller
                control={control}
                name="ai.includeContact"
                render={({ field }) => (
                  <Toggle
                    label="Include approved contact information"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!values.ai?.includeInChatbot}
                  />
                )}
              />
              <Toggle
                label="Exclude private notes from chatbot knowledge"
                description="Always on — internal notes are never shared."
                checked
                disabled
                onChange={() => {}}
              />
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-subtle/60 p-3 text-xs">
                <div>
                  <dt className="text-muted">Indexing status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={values.ai?.indexingStatus} map={INDEXING_STATUSES} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Last indexed (simulated)</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {values.ai?.lastIndexedAt ? formatDateTime(values.ai.lastIndexedAt) : 'Never'}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <p className="label flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-accent" aria-hidden="true" /> Chatbot knowledge preview
              </p>
              {preview ? (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-subtle/50 p-3 font-sans text-xs leading-relaxed text-ink">
                  {preview}
                </pre>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted">
                  This listing is excluded from chatbot knowledge.
                </p>
              )}
              <p className="helper">Internal notes are never included.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* H. Publishing sidebar */}
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <Card>
          <SectionHeader step="H" title="Publishing" />
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted">Current status</span>
            <StatusBadge status={initialValues.status} map={LISTING_STATUSES} />
          </div>
          <div className="grid gap-2">
            <Button
              variant="outline"
              icon={Save}
              onClick={submitWith('draft')}
              loading={submitting && action === 'draft'}
              disabled={submitting}
            >
              Save draft
            </Button>
            <Button
              variant="secondary"
              icon={Send}
              onClick={submitWith('pending')}
              loading={submitting && action === 'pending'}
              disabled={submitting}
            >
              Submit for review
            </Button>
            <Button
              icon={Send}
              onClick={submitWith('published')}
              disabled={submitting}
              loading={submitting && action === 'published'}
            >
              Save and publish
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          </div>
          <Controller
            control={control}
            name="featured"
            render={({ field }) => (
              <CheckboxField
                className="mt-4"
                label="Mark as featured"
                description="Paid placements are managed under Featured Listings."
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
          {isDirty && !saved && (
            <p className="mt-4 text-xs font-medium text-warning" role="status">
              You have unsaved changes.
            </p>
          )}
          <nav aria-label="Form sections" className="mt-5 hidden border-t border-line pt-4 xl:block">
            <ul className="space-y-1 text-sm">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block rounded-md px-2 py-1 text-muted hover:bg-subtle hover:text-ink"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Card>
        <DemoNotice className="mt-4">Saving updates this browser’s demo data only.</DemoNotice>
      </aside>

      <Modal
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
        title="Leave without saving?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard changes
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          You have unsaved changes to this listing. If you leave now, they’ll be lost.
        </p>
      </Modal>
    </form>
  );
}
