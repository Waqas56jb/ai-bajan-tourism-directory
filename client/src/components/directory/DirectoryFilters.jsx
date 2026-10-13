import { useId } from 'react';
import { categories, categoryBySlug } from '@/data/categories';
import { areas, parishes } from '@/data/destinations';
import { amenities as amenityVocabulary } from '@/data/amenities';

function FilterGroup({ title, children, id }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0 last:border-b-0" aria-labelledby={id}>
      <legend id={id} className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-navy">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Count({ n }) {
  return (
    <span className="ml-auto rounded-full bg-sand px-2 py-0.5 text-xs font-bold tabular-nums text-muted">
      {n ?? 0}
    </span>
  );
}

function OptionRow({ type = 'radio', name, checked, onChange, label, count, disabled }) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-[0.95rem] transition-colors hover:bg-sand/70 ${checked ? 'font-bold text-navy' : 'text-ink'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-[18px] w-[18px] shrink-0 accent-[#0b7671]"
      />
      <span className="min-w-0 flex-1">{label}</span>
      {count !== undefined && <Count n={count} />}
    </label>
  );
}

/**
 * Directory filter controls. Every option is backed by real data, and facet counts come from
 * the current result set. Rating filters are intentionally absent: no genuine ratings exist.
 *
 * @param {{ value: object, onChange: (changes: object) => void, facets?: object, lockCategory?: boolean, lockLocation?: boolean }} props
 */
export function DirectoryFilters({
  value,
  onChange,
  facets,
  lockCategory = false,
  lockLocation = false,
}) {
  const uid = useId();
  const f = facets ?? { categories: {}, locations: {}, types: {}, amenities: {}, featured: 0 };

  const typeOptions = Object.entries(f.types)
    .filter(([, n]) => n > 0)
    .map(([t]) => t)
    .concat(value.type && !f.types[value.type] ? [value.type] : [])
    .sort();

  const amenityOptions = Object.keys(amenityVocabulary).filter(
    (a) => (f.amenities[a] ?? 0) > 0 || value.amenities.includes(a),
  );

  return (
    <div>
      {!lockCategory && (
        <FilterGroup title="Category" id={`${uid}-cat`}>
          <div className="space-y-0.5">
            <OptionRow
              name={`${uid}-category`}
              checked={!value.category}
              onChange={() => onChange({ category: '', type: '' })}
              label="All categories"
            />
            {categories.map((c) => (
              <OptionRow
                key={c.slug}
                name={`${uid}-category`}
                checked={value.category === c.slug}
                onChange={() => onChange({ category: c.slug, type: '' })}
                label={c.name}
                count={f.categories[c.slug] ?? 0}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      {!lockLocation && (
        <FilterGroup title="Area or parish" id={`${uid}-loc`}>
          <label htmlFor={`${uid}-location`} className="sr-only">
            Area or parish
          </label>
          <select
            id={`${uid}-location`}
            className="field-input cursor-pointer"
            value={value.location}
            onChange={(e) => onChange({ location: e.target.value })}
          >
            <option value="">Anywhere in Barbados</option>
            <optgroup label="Towns & areas">
              {areas.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} ({f.locations[a.name] ?? 0})
                </option>
              ))}
            </optgroup>
            <optgroup label="Parishes">
              {parishes.map((p) => (
                <option key={p} value={p}>
                  {p} ({f.locations[p] ?? 0})
                </option>
              ))}
            </optgroup>
          </select>
        </FilterGroup>
      )}

      {typeOptions.length > 0 && (
        <FilterGroup
          title={
            value.category
              ? `${categoryBySlug[value.category]?.shortName ?? ''} type`
              : 'Business type'
          }
          id={`${uid}-type`}
        >
          <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            <OptionRow
              name={`${uid}-type`}
              checked={!value.type}
              onChange={() => onChange({ type: '' })}
              label="Any type"
            />
            {typeOptions.map((t) => (
              <OptionRow
                key={t}
                name={`${uid}-type`}
                checked={value.type === t}
                onChange={() => onChange({ type: t })}
                label={t}
                count={f.types[t] ?? 0}
              />
            ))}
          </div>
        </FilterGroup>
      )}

      {amenityOptions.length > 0 && (
        <FilterGroup title="Amenities" id={`${uid}-amen`}>
          <div className="space-y-0.5">
            {amenityOptions.map((a) => {
              const checked = value.amenities.includes(a);
              return (
                <OptionRow
                  key={a}
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      amenities: checked
                        ? value.amenities.filter((x) => x !== a)
                        : [...value.amenities, a],
                    })
                  }
                  label={amenityVocabulary[a].label}
                  count={f.amenities[a] ?? 0}
                />
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Promotions" id={`${uid}-promo`}>
        <OptionRow
          type="checkbox"
          checked={value.featured}
          onChange={() => onChange({ featured: !value.featured })}
          label="Featured listings only"
          count={f.featured}
        />
      </FilterGroup>
    </div>
  );
}
