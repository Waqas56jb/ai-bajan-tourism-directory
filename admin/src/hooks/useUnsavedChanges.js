import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Warn before leaving a form with unsaved edits:
 * - in-app navigation → returns a blocker the page renders as a confirm dialog
 * - tab close / reload → native beforeunload prompt
 */
export function useUnsavedChanges(isDirty) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  return blocker;
}
