import { Link } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { useUI } from '@/hooks/useUI';

export function AnnouncementBar() {
  const { announcementDismissed, dismissAnnouncement } = useUI();
  if (announcementDismissed) return null;
  return (
    <div className="bg-navy-900 text-white">
      <div className="container-page flex min-h-9 items-center justify-center gap-3 py-1.5 text-center text-[0.8rem] sm:text-sm">
        <Sparkles className="hidden h-4 w-4 shrink-0 text-lagoon sm:block" aria-hidden="true" />
        <p className="font-medium text-white/90">
          Your guide to discovering the real Barbados.{' '}
          <Link to="/discover" className="font-bold text-lagoon underline-offset-4 hover:underline">
            Start exploring
          </Link>
        </p>
        <button
          type="button"
          onClick={dismissAnnouncement}
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:absolute sm:right-4"
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
