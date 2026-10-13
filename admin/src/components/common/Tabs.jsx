import * as RadixTabs from '@radix-ui/react-tabs';

/**
 * Accessible tabs (arrow-key navigation, aria-selected) via Radix.
 * tabs: [{ value, label, count?, content }]
 */
export function Tabs({ tabs, value, onValueChange, defaultValue, className = '', listLabel = 'Sections' }) {
  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onValueChange}
      defaultValue={defaultValue ?? tabs[0]?.value}
      className={className}
    >
      <RadixTabs.List
        aria-label={listLabel}
        className="scrollbar-thin -mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1"
      >
        {tabs.map((t) => (
          <RadixTabs.Trigger
            key={t.value}
            value={t.value}
            className="relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent data-[state=active]:border-accent data-[state=active]:text-ink"
          >
            {t.icon && <t.icon className="h-4 w-4" aria-hidden="true" />}
            {t.label}
            {typeof t.count === 'number' && (
              <span className="rounded-full bg-subtle px-1.5 text-2xs font-semibold tabular text-muted">
                {t.count}
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((t) => (
        <RadixTabs.Content key={t.value} value={t.value} className="focus-visible:outline-none">
          {t.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
