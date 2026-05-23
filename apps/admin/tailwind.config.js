/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gabi: {
          primary: 'var(--gabi-primary)',
          accent: 'var(--gabi-accent)',
          muted: 'var(--gabi-text-muted)',
          surface: 'var(--gabi-surface)',
          bg: 'var(--gabi-bg)',
        },
      },
    },
  },
  plugins: [],
};
