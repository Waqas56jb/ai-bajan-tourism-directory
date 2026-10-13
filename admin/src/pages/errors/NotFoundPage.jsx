import { Compass, LayoutDashboard } from 'lucide-react';
import { usePageTitle } from '@/context/PageMetaContext';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

export default function NotFoundPage({
  title = 'Page not found',
  message = 'The page you’re looking for doesn’t exist or has moved.',
  backTo,
  backLabel,
}) {
  usePageTitle(title);
  return (
    <Card className="mx-auto mt-8 max-w-lg text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent-600">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">404</p>
      <h1 className="mt-1 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {backTo && (
          <Button variant="outline" to={backTo}>
            {backLabel ?? 'Go back'}
          </Button>
        )}
        <Button to="/" icon={LayoutDashboard}>
          Go to dashboard
        </Button>
      </div>
    </Card>
  );
}
