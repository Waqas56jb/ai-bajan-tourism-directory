import * as Popover from '@radix-ui/react-popover';
import { Columns3 } from 'lucide-react';
import { Button } from './Button';

/** Show/hide table columns. `columns` = [{ key, header, required? }]. */
export function ColumnToggle({ columns, hidden, onChange }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" icon={Columns3}>
          Columns
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[80] w-56 rounded-xl border border-line bg-surface p-2 shadow-pop"
        >
          <fieldset>
            <legend className="px-2 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-muted">
              Visible columns
            </legend>
            {columns
              .filter((c) => c.header)
              .map((c) => (
                <label
                  key={c.key}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${c.required ? 'opacity-60' : 'cursor-pointer hover:bg-subtle'}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(var(--accent))]"
                    checked={!hidden.includes(c.key)}
                    disabled={c.required}
                    onChange={() =>
                      onChange(
                        hidden.includes(c.key) ? hidden.filter((k) => k !== c.key) : [...hidden, c.key],
                      )
                    }
                  />
                  {c.header}
                </label>
              ))}
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
