import { forwardRef, useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

const MAX = 1000;

/** Message input. Enter sends, Shift+Enter adds a new line. Empty messages are not sent. */
export const ChatComposer = forwardRef(function ChatComposer({ onSend, pending }, ref) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState('');

  const submit = () => {
    if (!value.trim()) {
      setHint('Type a question first — for example, “What is Crop Over?”');
      return;
    }
    if (pending) return;
    const sent = onSend(value);
    if (sent !== false) {
      setValue('');
      setHint('');
    }
  };

  return (
    <form
      className="border-t border-line bg-white px-3 pb-3 pt-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-3xl border border-line bg-cream px-2 py-1.5 transition-colors focus-within:border-ocean focus-within:ring-4 focus-within:ring-ocean/15">
        <label htmlFor="chat-composer" className="sr-only">
          Ask AI Bajan a question
        </label>
        <textarea
          ref={ref}
          id="chat-composer"
          rows={1}
          value={value}
          maxLength={MAX}
          onChange={(e) => {
            setValue(e.target.value);
            if (hint) setHint('');
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything about Barbados…"
          aria-describedby="chat-composer-hint"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] text-ink placeholder:text-muted/80 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={pending ? 'Waiting for a response' : 'Send message'}
          className="mb-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-white transition-colors hover:bg-ocean-700 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      <p
        id="chat-composer-hint"
        className={`mt-1.5 px-2 text-xs ${hint ? 'font-semibold text-[#b4382d]' : 'text-muted'}`}
        aria-live="polite"
      >
        {hint ||
          (value.length > MAX - 100
            ? `${MAX - value.length} characters left`
            : 'AI Bajan answers from Barbadian sources and can make mistakes — check the sources for important details.')}
      </p>
    </form>
  );
});
