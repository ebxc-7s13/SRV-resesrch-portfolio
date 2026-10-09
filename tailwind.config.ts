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
      colors: { ...Object.fromEntries(['page','surface','panel','ink','muted','accent','accent-fill','on-accent','line','tint','danger'].map(name=>[name,`rgb(var(--${name}) / <alpha-value>)`])),
        emerald: Object.fromEntries([300, 400, 500].map(shade => [shade, `rgb(var(--emerald-${shade}) / <alpha-value>)`])),
        green: { 950: 'rgb(var(--footer-ink) / <alpha-value>)' },
      },
      backgroundColor: { accent: "rgb(var(--accent-fill) / <alpha-value>)" },
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
