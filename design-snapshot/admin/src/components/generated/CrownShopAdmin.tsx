import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Clock3, ExternalLink, Images, Inbox, LayoutDashboard, LogOut, MoreHorizontal, Scissors, Settings, Tag } from 'lucide-react';
import { cx } from './data';
import { useCrown } from './store';
import { LOGO_SRC, Logo } from './ui';
import { Avatar, Button, Confirm, Drawer, EASE, Menu, SITE_URL, ToastProvider } from './kit';
import { TeamAdmin } from './TeamAdmin';
import { Login, type Session } from './Login';
import { TodayView } from './Today';
import { BookingsView } from './Bookings';
import { MessagesView } from './Messages';
import { GalleryAdmin } from './GalleryAdmin';
import { PricesAdmin } from './PricesAdmin';
import { HoursAdmin } from './HoursAdmin';
import { SettingsAdmin } from './SettingsAdmin';
export type View = 'today' | 'bookings' | 'messages' | 'gallery' | 'team' | 'prices' | 'hours' | 'settings';
const NAV: {
  group: string;
  items: {
    id: View;
    label: string;
    icon: typeof Inbox;
  }[];
}[] = [{
  group: 'Shop',
  items: [{
    id: 'today',
    label: 'Today',
    icon: LayoutDashboard
  }, {
    id: 'bookings',
    label: 'Bookings',
    icon: CalendarDays
  }, {
    id: 'messages',
    label: 'Messages',
    icon: Inbox
  }]
}, {
  group: 'Website',
  items: [{
    id: 'gallery',
    label: 'Gallery',
    icon: Images
  }, {
    id: 'team',
    label: 'Behind the chair',
    icon: Scissors
  }, {
    id: 'prices',
    label: 'Prices',
    icon: Tag
  }, {
    id: 'hours',
    label: 'Hours & notices',
    icon: Clock3
  }]
}];
const ALL = [...NAV.flatMap(g => g.items), {
  id: 'settings' as View,
  label: 'Settings',
  icon: Settings
}];
const TABS: View[] = ['today', 'bookings', 'messages', 'gallery'];
const KEY = 'crown:admin:session';
const fromHash = (): View => {
  const v = window.location.hash.replace('#/', '') as View;
  return ALL.some(n => n.id === v) ? v : 'today';
};
function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch {
    return null;
  }
}
export const CrownShopAdmin = () => {
  const [session, setSession] = useState<Session | null>(readSession);
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = LOGO_SRC;
  }, []);
  if (!session) {
    return <Login onIn={(s, remember) => {
      (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
      setSession(s);
    }} />;
  }
  return <ToastProvider>
      <Portal session={session} onSignOut={() => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      setSession(null);
    }} />
    </ToastProvider>;
};
function NavButton({
  label,
  icon: Icon,
  active,
  count,
  onClick
}: {
  label: string;
  icon: typeof Inbox;
  active: boolean;
  count?: {
    n: number;
    tone: 'muted' | 'alert';
  };
  onClick: () => void;
}) {
  return <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={cx('relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-150', active ? 'bg-white text-[#14215c] shadow-[0_1px_2px_rgb(0_0_0/0.2)]' : 'text-white/75 hover:bg-white/10 hover:text-white')}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="flex-1 text-left">{label}</span>
      {count && count.n > 0 && <span className={cx('num inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold', count.tone === 'alert' ? 'bg-red-500 text-white' : active ? 'bg-[#14215c]/10 text-[#14215c]' : 'bg-white/15 text-white')}>
          {count.n}
        </span>}
    </button>;
}
function Portal({
  session,
  onSignOut
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const crown = useCrown();
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>(fromHash);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<View | null>(null);
  const [more, setMore] = useState(false);
  const [msgId, setMsgId] = useState<string | null>(null);
  const counts: Partial<Record<View, {
    n: number;
    tone: 'muted' | 'alert';
  }>> = {
    bookings: {
      n: crown.bookings.filter(b => b.status === 'requested').length,
      tone: 'alert'
    },
    messages: {
      n: crown.messages.filter(m => !m.read && !m.archived).length,
      tone: 'alert'
    },
    gallery: {
      n: crown.gallery.length,
      tone: 'muted'
    }
  };
  useEffect(() => {
    const on = () => setView(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    setDirty(false);
    document.title = `${ALL.find(n => n.id === view)?.label ?? ''} · Crown admin`;
    document.documentElement.scrollTo({
      top: 0
    });
    const t = window.setTimeout(() => document.querySelector<HTMLElement>('[data-admin-title]')?.focus({
      preventScroll: true
    }), 200);
    return () => window.clearTimeout(t);
  }, [view]);
  const go = useCallback((v: View) => {
    setMore(false);
    if (v === view) return;
    if (dirty) return setPending(v);
    window.location.hash = `/${v}`;
  }, [view, dirty]);
  const onDirty = useCallback((d: boolean) => setDirty(d), []);
  const screens: Record<View, ReactNode> = {
    today: <TodayView go={go} openMessage={id => {
      setMsgId(id);
      go('messages');
    }} />,
    bookings: <BookingsView />,
    messages: <MessagesView initialId={msgId} />,
    gallery: <GalleryAdmin />,
    prices: <PricesAdmin onDirty={onDirty} />,
    hours: <HoursAdmin onDirty={onDirty} />,
    team: <TeamAdmin onDirty={onDirty} />,
    settings: <SettingsAdmin session={session} onSignOut={onSignOut} />
  };
  return <div className="admin flex min-h-[100dvh] w-full bg-canvas text-fg">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-[240px] shrink-0 flex-col overflow-hidden bg-[#14215c] text-white lg:flex">
        <div className="pole-stripe h-1.5 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-3 px-4 pb-4 pt-5">
          <Logo className="h-12 w-auto" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[19px]">Crown</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">Barber shop admin</p>
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.map(g => <div key={g.group} className="mb-4">
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/45">{g.group}</p>
              <div className="grid gap-0.5">
                {g.items.map(it => <NavButton key={it.id} label={it.label} icon={it.icon} active={view === it.id} count={counts[it.id]} onClick={() => go(it.id)} />)}
              </div>
            </div>)}
        </nav>
        <div className="relative grid gap-0.5 border-t border-white/10 p-3">
          <div className="checker-sm pointer-events-none absolute inset-x-0 -top-24 h-24 opacity-[0.08] [mask-image:linear-gradient(to_top,black,transparent)]" aria-hidden="true" />
          <NavButton label="Settings" icon={Settings} active={view === 'settings'} onClick={() => go('settings')} />
          <a href={SITE_URL} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> View website
          </a>
          <div className="mt-2 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <Avatar name={session.name} size="sm" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12px] font-medium text-white">{session.name}</p>
              <p className="truncate text-[11px] text-white/55">{session.email}</p>
            </div>
            <Menu label="Account" items={[{
            label: 'Sign out',
            icon: <LogOut className="h-4 w-4" strokeWidth={1.75} />,
            onSelect: onSignOut
          }]} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* phone / tablet top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-[#14215c] px-4 text-white lg:hidden">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
            <span className="font-display text-[18px]">{ALL.find(n => n.id === view)?.label}</span>
          </div>
          <div className="[&>div>button]:text-white [&>div>button:hover]:bg-white/10">
            <Menu label="Account" items={[{
            label: 'View website',
            icon: <ExternalLink className="h-4 w-4" strokeWidth={1.75} />,
            onSelect: () => {},
            href: SITE_URL
          }, {
            label: 'Settings',
            icon: <Settings className="h-4 w-4" strokeWidth={1.75} />,
            onSelect: () => go('settings')
          }, 'divider', {
            label: 'Sign out',
            icon: <LogOut className="h-4 w-4" strokeWidth={1.75} />,
            onSelect: onSignOut
          }]} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-28 pt-5 md:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{
            opacity: 0,
            y: reduce ? 0 : 4
          }} animate={{
            opacity: 1,
            y: 0
          }} exit={{
            opacity: 0,
            transition: {
              duration: 0.1
            }
          }} transition={{
            duration: 0.2,
            ease: EASE
          }}>
              {screens[view]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* phone bottom tabs */}
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-stroke bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {[...TABS.map(id => ALL.find(n => n.id === id)!), {
          id: 'more' as const,
          label: 'More',
          icon: MoreHorizontal
        }].map(n => {
          const Icon = n.icon;
          const active = n.id === 'more' ? !TABS.includes(view) : view === n.id;
          const c = n.id === 'more' ? undefined : counts[n.id as View];
          return <li key={n.id}>
                <button type="button" onClick={() => n.id === 'more' ? setMore(true) : go(n.id as View)} aria-current={active ? 'page' : undefined} className={cx('relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active ? 'text-accent' : 'text-fg-subtle')}>
                  <span className="relative">
                    <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                    {c && c.tone === 'alert' && c.n > 0 && <span className="num absolute -right-2.5 -top-1 min-w-[16px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{c.n}</span>}
                  </span>
                  {n.label}
                </button>
              </li>;
        })}
        </ul>
      </nav>

      <Drawer open={more} onClose={() => setMore(false)} title="More">
        <div className="grid gap-1">
          {ALL.filter(n => !TABS.includes(n.id)).map(n => <Button key={n.id} variant={view === n.id ? 'secondary' : 'ghost'} className="justify-start" icon={<n.icon className="h-4 w-4" strokeWidth={1.75} />} onClick={() => go(n.id)}>
              {n.label}
            </Button>)}
          <Button variant="ghost" className="justify-start" icon={<LogOut className="h-4 w-4" strokeWidth={1.75} />} onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Drawer>

      <Confirm open={pending !== null} title="Discard unsaved changes?" body="You edited this page but did not save. Leaving now throws those edits away." confirmLabel="Discard and leave" onCancel={() => setPending(null)} onConfirm={() => {
      const v = pending;
      setPending(null);
      setDirty(false);
      if (v) window.location.hash = `/${v}`;
    }} />
    </div>;
}