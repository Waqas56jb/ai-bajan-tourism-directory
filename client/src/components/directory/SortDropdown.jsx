import { SORT_OPTIONS } from '@/lib/search';
import { SelectField } from '@/components/common/Fields';

/** Sort control. Only sorts backed by real data are offered (no rating/popularity sorts). */
export function SortDropdown({ value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="hidden text-sm font-bold text-muted sm:inline" aria-hidden="true">
        Sort
      </span>
      <SelectField
        label="Sort results"
        hideLabel
        options={SORT_OPTIONS}
        value={value}
        onValueChange={onChange}
        className="w-44"
      />
    </div>
  );
}
