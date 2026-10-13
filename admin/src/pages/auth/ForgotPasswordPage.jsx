import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/services/authService';
import { TextField } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';
import { DemoNotice } from '@/components/common/States';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
});

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setError('');
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <Link
        to="/login"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
      </Link>
      {sentTo ? (
        <div role="status">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted">
            If an account exists for {sentTo}, a reset link would be sent.
          </p>
          <DemoNotice className="mt-5">
            No email was sent — password recovery will be handled by the backend once connected.
          </DemoNotice>
          <Button to="/login" variant="outline" className="mt-6 w-full">
            Return to sign in
          </Button>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">
            Enter the email for your admin account and we’ll send reset instructions.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
