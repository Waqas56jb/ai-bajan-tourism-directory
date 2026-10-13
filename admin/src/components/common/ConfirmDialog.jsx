import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialogs:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title, message, confirmLabel, tone: 'danger' });
 *   const { confirmed, value } = await confirm({ ..., input: { label: 'Reason', required: true } });
 * When `input` is set the promise resolves to { confirmed, value }.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef(null);
  const inputId = useId();
  const inputRef = useRef(null);
  const cancelRef = useRef(null);

  const confirm = useCallback((options) => {
    setValue(options.input?.defaultValue ?? '');
    setError('');
    setState(options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (confirmed) => {
    if (confirmed && state?.input?.required && !value.trim()) {
      setError(`${state.input.label} is required.`);
      inputRef.current?.focus();
      return;
    }
    const result = state?.input ? { confirmed, value: value.trim() } : confirmed;
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const danger = state?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onOpenChange={(o) => !o && close(false)}
        title={state?.title ?? ''}
        size="sm"
        initialFocusRef={state?.input ? inputRef : cancelRef}
        footer={
          <>
            <Button ref={cancelRef} variant="outline" onClick={() => close(false)}>
              {state?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button variant={danger ? 'destructive' : 'primary'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${danger ? 'bg-danger/10 text-danger' : 'bg-info/10 text-info'}`}
          >
            {danger ? (
              <AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Info className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1 text-sm text-muted">
            {state?.message}
            {state?.input && (
              <div className="mt-4">
                <label htmlFor={inputId} className="label">
                  {state.input.label}
                  {state.input.required && <span className="text-danger"> *</span>}
                </label>
                <textarea
                  ref={inputRef}
                  id={inputId}
                  rows={3}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError('');
                  }}
                  placeholder={state.input.placeholder}
                  className="field"
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? `${inputId}-e` : undefined}
                />
                {error && (
                  <p id={`${inputId}-e`} className="error-text" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>.');
  return ctx;
}
