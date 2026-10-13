import { Link2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}

/** Native share sheet where available, otherwise copy the link. */
export function ShareButton({ title, text, url, icon: IconComponent = Share2, className = '' }) {
  const share = async () => {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // user closed the share sheet
      }
    }
    try {
      await copyText(shareUrl);
      toast.success('Link copied', { description: 'Paste it anywhere to share.' });
    } catch {
      toast.error('Couldn’t copy the link', { description: shareUrl });
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2.5 text-sm font-bold text-navy transition-colors hover:border-navy"
      >
        <IconComponent className="h-4 w-4" aria-hidden="true" />
        Share
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await copyText(url ?? window.location.href);
            toast.success('Link copied');
          } catch {
            toast.error('Couldn’t copy the link');
          }
        }}
        className="grid h-11 w-11 place-items-center rounded-full border border-navy/15 bg-white text-navy transition-colors hover:border-navy"
        aria-label="Copy link"
        title="Copy link"
      >
        <Link2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
