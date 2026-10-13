import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu, MessageCircle, Search } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { routes } from '@/lib/routes';
import { AnnouncementBar } from './AnnouncementBar';
import { DesktopNavigation } from './DesktopNavigation';
import { MobileNavigation } from './MobileNavigation';
import { SearchDialog } from './SearchDialog';

/**
 * Fixed site chrome (announcement + header).
 * `overlay` pages start with a transparent header over a full-bleed hero; it turns solid and
 * compact after scrolling. The chrome height is published as --chrome-h so heroes and the
 * page spacer can account for it.
 */
export function Header({ overlay = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const chromeRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return undefined;
    // Only measure the full (unscrolled) chrome so the spacer/hero offset never changes while
    // the header compacts on scroll — that would make the page jump.
    const publish = () => {
      if (window.scrollY <= 24)
        document.documentElement.style.setProperty('--chrome-h', `${el.offsetHeight}px`);
    };
    publish();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const transparent = overlay && !scrolled;
  const light = transparent;

  return (
    <>
      <div ref={chromeRef} className="fixed inset-x-0 top-0 z-50">
        {!scrolled && <AnnouncementBar />}
        <header
          className={`transition-[background-color,box-shadow,border-color] duration-300 ${
            transparent
              ? 'border-b border-transparent bg-gradient-to-b from-navy-900/55 to-transparent'
              : 'border-b border-line/80 bg-cream/95 shadow-[0_8px_24px_-18px_rgba(18,48,68,0.35)] backdrop-blur-md'
          }`}
        >
          <div
            className={`container-page flex items-center justify-between gap-4 transition-[height] duration-300 ${scrolled ? 'h-16' : 'h-[4.5rem] lg:h-20'}`}
          >
            <Logo tone={light ? 'light' : 'dark'} />
            <DesktopNavigation light={light} />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <IconButton
                label="Search"
                icon={Search}
                onClick={() => setSearchOpen(true)}
                className={light ? 'text-white hover:!bg-white/10' : ''}
              />
              <Button
                variant={light ? 'glass' : 'accent'}
                size="sm"
                className="hidden sm:inline-flex"
                to={routes.ask()}
                iconLeft={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
              >
                Start asking
              </Button>
              <Button
                variant={light ? 'light' : 'primary'}
                size="sm"
                to={routes.contact('listing')}
                className="hidden xl:inline-flex"
              >
                List Your Business
              </Button>
              <IconButton
                label="Open menu"
                icon={Menu}
                onClick={() => setMenuOpen(true)}
                className={`lg:hidden ${light ? 'text-white hover:!bg-white/10' : ''}`}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
              />
            </div>
          </div>
        </header>
      </div>
      {!overlay && <div aria-hidden="true" style={{ height: 'var(--chrome-h, 108px)' }} />}
      <MobileNavigation open={menuOpen} onOpenChange={setMenuOpen} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
