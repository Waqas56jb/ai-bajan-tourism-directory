import * as Menu from '@radix-ui/react-dropdown-menu';
import { Link } from 'react-router-dom';

/**
 * Accessible dropdown (arrow keys, typeahead, Escape) via Radix.
 * items: [{ label, icon, onSelect | to, tone: 'danger', disabled, separatorBefore }]
 */
export function DropdownMenu({ trigger, items, align = 'end', label, header }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          sideOffset={6}
          aria-label={label}
          className="z-[80] min-w-[12rem] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          {header && <div className="border-b border-line px-2.5 pb-2 pt-1.5">{header}</div>}
          {items.filter(Boolean).map((item, i) => (
            <div key={`${item.label}-${i}`}>
              {item.separatorBefore && <Menu.Separator className="my-1 h-px bg-line" />}
              <Menu.Item
                disabled={item.disabled}
                onSelect={item.to ? undefined : item.onSelect}
                asChild={Boolean(item.to)}
                className={`flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-subtle ${
                  item.tone === 'danger' ? 'text-danger data-[highlighted]:bg-danger/10' : 'text-ink'
                }`}
              >
                {item.to ? (
                  <Link to={item.to}>
                    {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />}
                    {item.label}
                  </Link>
                ) : (
                  <>
                    {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />}
                    {item.label}
                  </>
                )}
              </Menu.Item>
            </div>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
