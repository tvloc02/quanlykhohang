import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#06B6D4',
        'primary-light': '#7EE7F5',
        'primary-dark': '#0891B2',
        'secondary': '#CFF9FB',
        'accent': '#E6FBFF',
      },
      backgroundColor: {
        'primary-bg': '#F0FDFF',
      },
    },
  },
  plugins: [],
} satisfies Config;
