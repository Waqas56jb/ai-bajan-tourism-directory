import { Home, Plane } from 'lucide-react';
import { useAudience } from '@/hooks/useAudience';

/** Resident / visitor switch: tunes AI Bajan's answers (e.g. NIS and buses vs tours and transfers). */
export function AudienceSwitch({ tone = 'dark', className = '' }) {
  const [audience, setAudience] = useAudience();
  const light = tone === 'dark';
  const options = [
    { value: 'resident', label: 'I live here', icon: Home },
    { value: 'visitor', label: 'I’m visiting', icon: Plane },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Answer for"
      className={`inline-flex rounded-full p-1 ${light ? 'bg-white/10 ring-1 ring-white/20' : 'bg-white ring-1 ring-line'} ${className}`}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = audience === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setAudience(value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition ${
              active ? (light ? 'bg-white text-navy' : 'bg-navy text-white') : light ? 'text-white/80 hover:text-white' : 'text-navy/70 hover:text-navy'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}
