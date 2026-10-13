import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, FlaskConical, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { DEMO_ACCOUNT_EMAIL } from '@/services/authService';
import { IS_DEMO } from '@/config/environment';
import { TextField, CheckboxField } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').min(8, 'Password must be at least 8 characters.'),
  remember: z.boolean(),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '', remember: false } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      toast.success('Signed in to the demo dashboard');
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to manage the AI Bajan platform.</p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-7 space-y-4"
        aria-describedby={formError ? 'login-error' : undefined}
      >
        {formError && (
          <p
            id="login-error"
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
          >
            {formError}
          </p>
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <div className="relative">
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              error={errors.password?.message}
              className="[&_input]:pr-10"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1.5 top-[1.85rem] grid h-7 w-7 place-items-center rounded text-muted hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <CheckboxField label="Remember me" {...register('remember')} />
          <Link to="/forgot-password" className="text-sm font-medium text-accent-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={LogIn}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {IS_DEMO && (
      <div className="mt-6 rounded-xl border border-sand/50 bg-sand/10 p-4 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-ink">
          <FlaskConical className="h-4 w-4 text-sand-600" aria-hidden="true" /> Demo account (frontend only)
        </p>
        <p className="mt-1 text-muted">
          Email <code className="rounded bg-surface px-1 text-ink">{DEMO_ACCOUNT_EMAIL}</code> with any
          password of 8+ characters. This is not real authentication and no password is stored.
        </p>
        <button
          type="button"
          onClick={() => setValue('email', DEMO_ACCOUNT_EMAIL, { shouldValidate: true })}
          className="mt-2 text-xs font-semibold text-accent-600 hover:underline"
        >
          Use demo email
        </button>
      </div>
      )}
    </div>
  );
}
