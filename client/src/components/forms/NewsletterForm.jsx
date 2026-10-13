import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send } from 'lucide-react';
import { newsletterSchema } from '@/lib/validation';
import { submitNewsletter } from '@/lib/services';
import { IS_DEMO } from '@/lib/config';
import { Button } from '@/components/common/Button';

/**
 * Newsletter form with validation, loading, success and error states. In demo mode it says
 * plainly that no subscription was created.
 */
export default function NewsletterForm({ tone = 'light', compact = false }) {
  const uid = useId();
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '', consent: false },
  });

  const dark = tone === 'dark';

  const onSubmit = async (values) => {
    setStatus({ state: 'idle', message: '' });
    try {
      const res = await submitNewsletter(values);
      reset();
      setStatus(
        res?.demo
          ? {
              state: 'demo',
              message:
                'Demo mode: the form works, but no email service is connected yet, so you have not been subscribed.',
            }
          : {
              state: 'success',
              message: 'Thanks! Please check your inbox to confirm your subscription.',
            },
      );
    } catch (error) {
      setStatus({
        state: 'error',
        message: error?.message || 'We couldn’t subscribe you right now. Please try again.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-describedby={`${uid}-status`}>
      <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'}`}>
        <div className="flex-1">
          <label htmlFor={`${uid}-email`} className="sr-only">
            Email address
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? `${uid}-email-error` : undefined}
            className={`field-input ${dark ? '!border-white/20 !bg-white/10 !text-white placeholder:!text-white/50' : ''} ${compact ? '' : '!min-h-[3.25rem] !rounded-full !px-5'}`}
            {...register('email')}
          />
        </div>
        <Button
          type="submit"
          variant={dark ? 'coral' : 'primary'}
          size={compact ? 'md' : 'lg'}
          loading={isSubmitting}
          iconRight={!compact && <Send className="h-4 w-4" aria-hidden="true" />}
        >
          Subscribe
        </Button>
      </div>
      {errors.email && (
        <p id={`${uid}-email-error`} className={`field-error ${dark ? '!text-coral' : ''}`}>
          {errors.email.message}
        </p>
      )}
      <label
        className={`mt-3 flex cursor-pointer items-start gap-2.5 text-sm ${dark ? 'text-white/70' : 'text-muted'}`}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#0b7671]"
          aria-invalid={errors.consent ? 'true' : 'false'}
          {...register('consent')}
        />
        <span>
          I’d like to receive occasional AI Bajan emails. I can unsubscribe at any time. See the{' '}
          <Link to="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>
          .
        </span>
      </label>
      {errors.consent && (
        <p className={`field-error ${dark ? '!text-coral' : ''}`}>{errors.consent.message}</p>
      )}
      <div id={`${uid}-status`} role="status" aria-live="polite">
        {status.state !== 'idle' && (
          <p
            className={`mt-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold ${
              status.state === 'error'
                ? 'bg-coral/15 text-[#9d2f25]'
                : dark
                  ? 'bg-white/10 text-white'
                  : 'bg-ocean/10 text-ocean-700'
            } ${dark && status.state === 'error' ? '!text-coral' : ''}`}
          >
            {status.state !== 'error' && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {status.message}
          </p>
        )}
      </div>
      {IS_DEMO && status.state === 'idle' && !compact && (
        <p className="mt-3 text-xs text-muted">
          Frontend demo: submissions aren’t sent anywhere yet.
        </p>
      )}
    </form>
  );
}
