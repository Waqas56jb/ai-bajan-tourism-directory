import { useCallback, useState } from 'react';
import { readJSON, writeJSON } from '@/utils/storage';

/** UI preferences persisted under the demo namespace (falls back to memory if unavailable). */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => readJSON(key, initial));
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        writeJSON(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}
