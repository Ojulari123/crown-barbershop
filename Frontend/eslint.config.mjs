import next from 'eslint-config-next';

const config = [
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts'],
  },
  ...next,
  {
    rules: {
      // The design renders plain <img> everywhere (remote Unsplash stand-ins, data: previews,
      // uploaded media). Swapping to next/image would change markup and layout.
      '@next/next/no-img-element': 'off',
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // src/components is the MagicPath design ported 1-to-1 (fidelity is the product).
    // These rules flag patterns in that verbatim code; "fixing" them would change the
    // design's markup or behaviour, so they are warnings there and errors everywhere else.
    files: ['src/components/**/*.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-key': 'warn',
      // Plain same-origin <a href="/..."> is the design's markup; the site shell turns those
      // clicks into client navigations (decisions F5), so next/link is not needed.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;
