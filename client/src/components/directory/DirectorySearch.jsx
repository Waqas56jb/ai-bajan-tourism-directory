import { useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/common/Fields';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Debounced search box bound to the URL `q` param. Typing updates results after a short
 * pause; Enter applies immediately. External changes (e.g. removing the chip) sync back in.
 */
export function DirectorySearch({
  value,
  onSearch,
  placeholder = 'Search by name, keyword or place',
  className = '',
}) {
  const [input, setInput] = useState(value);
  const debounced = useDebounce(input, 320);
  const lastSent = useRef(value);

  useEffect(() => {
    if (debounced.trim() !== lastSent.current) {
      lastSent.current = debounced.trim();
      onSearch(debounced.trim(), { replace: true });
    }
  }, [debounced, onSearch]);

  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setInput(value);
    }
  }, [value]);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        lastSent.current = input.trim();
        onSearch(input.trim());
      }}
    >
      <SearchInput
        value={input}
        onChange={setInput}
        onClear={() => {
          setInput('');
          lastSent.current = '';
          onSearch('');
        }}
        label="Search the directory"
        placeholder={placeholder}
        inputClassName="!min-h-[3.25rem] !rounded-full shadow-soft"
      />
    </form>
  );
}
