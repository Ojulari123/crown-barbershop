import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Bodoni_Moda, Libre_Franklin } from 'next/font/google';
import { LOGO_SRC } from '@/lib/data';
import './globals.css';

// Same CSS variables and fallbacks as the design's :root (globals.css). The classes go on
// <body> so these values override the :root declarations for everything on the page.
const display = Bodoni_Moda({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-display',
  fallback: ['Didot', 'Georgia', 'serif'],
  display: 'swap',
});
const sign = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-sign',
  fallback: ['Arial Narrow', 'sans-serif'],
  display: 'swap',
});
const body = Libre_Franklin({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Crown Barber Shop | Old-school cuts in Guelph',
  icons: { icon: LOGO_SRC },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${display.variable} ${sign.variable} ${body.variable}`}>
        {/* #root: the design's stylesheet sizes html, body and #root together. */}
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
