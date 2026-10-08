import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(['page','surface','panel','ink','muted','accent','on-accent','line','tint','danger'].map(name=>[name,`rgb(var(--${name}) / <alpha-value>)`])),
      fontFamily: {
        sans: ['var(--font-space)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        display: ['var(--font-space)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        brutal: '0.15em',
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
};

export default config;
