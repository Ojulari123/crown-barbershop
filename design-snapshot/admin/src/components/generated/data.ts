// Shop facts gathered from public listings (Facebook, Fresha, BestProsInTown, Birdeye).
// Anything marked CONFIRM is a placeholder the owner should verify before launch.

export const SHOP = {
  name: 'Crown Barber Shop',
  street: '219 Silvercreek Pkwy N',
  city: 'Guelph',
  region: 'ON',
  postal: 'N1H 7K4',
  landmark: 'at Speedvale',
  phoneDisplay: '(519) 763-2229',
  phoneHref: 'tel:+15197632229',
  facebook: 'https://www.facebook.com/p/Crown-Barber-Shop-100037221112896/',
  mapsDirections:
    'https://www.google.com/maps/dir/?api=1&destination=219+Silvercreek+Pkwy+N,+Guelph,+ON+N1H+7K4',
  mapsEmbed:
    'https://maps.google.com/maps?q=219%20Silvercreek%20Pkwy%20N%2C%20Guelph%2C%20ON%20N1H%207K4&z=15&output=embed',
  rating: 4.8,
  reviewCount: 127,
  reviewSource: 'https://reviews.birdeye.com/crown-barber-shop-170207234232461',
};

// Photos are open-license Unsplash stand-ins. Swap for real shop photos before launch.
const u = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;

export const PHOTOS = {
  hero: u('1778676688264-2a5db8886ab3', 1000, 1250),
  chair: u('1781925856343-c97d0d44f94c', 1400, 1000),
  pole: u('1780688373499-c570319873a3', 700, 900),
  cut: u('1686671805337-7d8aa64b965f', 900, 700),
};

export type ServiceCategory = 'cuts' | 'shaves';

export type Service = {
  id: string;
  name: string;
  detail: string;
  minutes: number;
  price: number;
  category: ServiceCategory;
  visible?: boolean;
};

// Fade price comes from reviews ($31 to $34). The rest are CONFIRM placeholders.
export const SERVICES: Service[] = [
  { id: 'classic', name: 'Classic cut', detail: 'Scissor or clipper, finished with a neck shave', minutes: 30, price: 31, category: 'cuts' },
  { id: 'fade', name: 'Skin fade', detail: 'Low, mid or high, blended by hand', minutes: 40, price: 34, category: 'cuts' },
  { id: 'kids', name: 'Kids cut', detail: 'Under 12, patience included', minutes: 25, price: 25, category: 'cuts' },
  { id: 'senior', name: 'Seniors cut', detail: '65 and over', minutes: 25, price: 25, category: 'cuts' },
  { id: 'beard', name: 'Beard trim', detail: 'Shape, line-up and a hot towel', minutes: 20, price: 15, category: 'shaves' },
  { id: 'cut-beard', name: 'Cut and beard', detail: 'Any cut with a full beard trim', minutes: 50, price: 44, category: 'shaves' },
  { id: 'head', name: 'Head shave', detail: 'Straight razor, lather and hot towel', minutes: 30, price: 30, category: 'shaves' },
  { id: 'hot-towel', name: 'Hot towel shave', detail: 'The full old-school face shave', minutes: 40, price: 35, category: 'shaves' },
];

export type Barber = { id: string; name: string; note: string; role?: string; bio?: string; specialties?: string[]; photo?: string };

// Only Tania is named in public reviews. Add the rest of the crew here.
export const BARBERS: Barber[] = [
  { id: 'any', name: 'First available', note: 'Shortest wait' },
  // Bio is a starter placeholder based only on what reviews confirm. The owner replaces it in the admin (Behind the chair).
  {
    id: 'tania',
    name: 'Tania',
    note: 'Named in more reviews than anyone',
    role: 'Barber',
    bio: "Tania cuts at Crown on Silvercreek Parkway, and plenty of regulars come in asking for her by name. Sit down, tell her what you're after, and she'll take it from there.",
  },
];

// Hours as listed on Facebook and BestProsInTown. Shop closes 2 to 3 PM on weekdays.
// Index 0 = Sunday. Ranges in minutes after midnight, Toronto time.
export const HOURS: [number, number][][] = [
  [],
  [],
  [[600, 840], [900, 1080]],
  [[600, 840], [900, 1080]],
  [[600, 840], [900, 1140]],
  [[600, 840], [900, 1140]],
  [[540, 840]],
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Real reviews (Birdeye and BestProsInTown, as of Sep 2026). `when` is relative to that date.
// Individual star ratings were not published with these, so cards show none.
export type Review = { quote: string; name: string; source: string; when?: string; mentions?: string };

export const REVIEWS: Review[] = [
  { quote: "All the kings (and a few queens) get their hair cut at the crown. Its cash only, and be prepared to wait - but it's worth it.", name: "Ze'ev G.", source: 'Birdeye', when: '2 weeks ago' },
  { quote: 'Tania is fantastic!!! She has wonderful sens of humour and does an incredible job.', name: 'Andrew C.', source: 'Birdeye', when: '2 months ago', mentions: 'tania' },
  { quote: 'You get everything you could want for $34. No extra fees.', name: 'Local reviewer', source: 'BestProsInTown' },
  { quote: 'I had a great experience at Crown Barber Shop!', name: 'David K.', source: 'Birdeye', when: '1 month ago' },
  { quote: 'Feels like an oldschool barbershop.', name: 'Local reviewer', source: 'BestProsInTown' },
  { quote: 'Thank you for the lovely haircut, Tania.', name: 'P. H.', source: 'Birdeye', when: '5 months ago', mentions: 'tania' },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I need an appointment?',
    a: 'No. Crown is a walk-in shop. Come by any time we are open and take a seat. Reserving a chair online just holds your spot.',
  },
  {
    q: 'How do I pay?',
    a: 'Cash only. The price on the board is the price you pay, with no extra fees.',
  },
  {
    q: 'How long is the wait?',
    a: 'It depends on the day, and Saturdays fill up fast. Call the shop and we will tell you how busy it is right now.',
  },
  {
    q: 'Are you closed over lunch?',
    a: 'Yes. Tuesday to Friday we step out from 2 to 3 PM. Saturday runs straight through from 9 AM to 2 PM.',
  },
  {
    q: 'I am not sure what cut I want.',
    a: 'Bring a photo on your phone. It is the fastest way to get exactly what you are picturing.',
  },
  {
    q: 'Where do I find you?',
    a: '219 Silvercreek Parkway North, at the corner of Speedvale Avenue in Guelph.',
  },
];

// ---------- time helpers (always Toronto time) ----------

export function torontoNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return {
    day: dayIndex,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function fmtTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function fmtRange([a, b]: [number, number]) {
  return `${fmtTime(a)} to ${fmtTime(b)}`;
}

export type ShopStatus = { open: boolean; label: string; detail: string };

export function shopStatus(date = new Date()): ShopStatus {
  const { day, minutes } = torontoNow(date);
  const today = HOURS[day];
  const current = today.find(([a, b]) => minutes >= a && minutes < b);
  if (current) return { open: true, label: 'Open now', detail: `until ${fmtTime(current[1])}` };
  const laterToday = today.find(([a]) => minutes < a);
  if (laterToday) {
    const onBreak = today.some(([, b]) => minutes >= b);
    return { open: false, label: onBreak ? 'On lunch' : 'Closed', detail: `back at ${fmtTime(laterToday[0])}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (HOURS[d].length) {
      const when = i === 1 ? 'tomorrow' : DAY_NAMES[d];
      return { open: false, label: 'Closed', detail: `opens ${when} at ${fmtTime(HOURS[d][0][0])}` };
    }
  }
  return { open: false, label: 'Closed', detail: '' };
}

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
