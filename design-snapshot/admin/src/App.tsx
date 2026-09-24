import { Theme } from './settings/types';
import { CrownShopAdmin } from './components/generated/CrownShopAdmin';

// Design fonts. MagicPath rewrites the Google Fonts @import on line 1 of index.css, so the same
// css2 request (Bodoni Moda, Barlow Condensed, Libre Franklin) is added here as a stylesheet link.
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Libre+Franklin:wght@400;500;600&display=swap';
if (typeof document !== 'undefined' && !document.getElementById('crown-fonts')) {
  const link = document.createElement('link');
  link.id = 'crown-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

let theme: Theme = 'light';

function App() {
  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setTheme(theme);

  return (
    <>
      <CrownShopAdmin />
    </>
  ); // %EXPORT_STATEMENT%
}

export default App;
