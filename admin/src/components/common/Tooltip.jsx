import * as RadixTooltip from '@radix-ui/react-tooltip';

export function TooltipProvider({ children }) {
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={150}>
      {children}
    </RadixTooltip.Provider>
  );
}

/** Accessible tooltip (shows on hover and keyboard focus). */
export function Tooltip({ content, children, side = 'top', disabled = false }) {
  if (disabled || !content) return children;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[100] max-w-xs rounded-md bg-navy-800 px-2 py-1 text-xs font-medium text-surface shadow-pop data-[state=delayed-open]:animate-in"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
