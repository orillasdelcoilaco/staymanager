/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../frontend/index.html",
    "../frontend/src/**/*.js",
    "./views/**/*.ejs",
  ],
  safelist: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        danger: {
          50:  '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        success: {
          50:  '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50:  '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontSize: {
        'display': ['2rem',     { lineHeight: '2.5rem',  fontWeight: '700' }],
        'heading': ['1.5rem',   { lineHeight: '2rem',    fontWeight: '600' }],
        'subhead': ['1.25rem',  { lineHeight: '1.75rem', fontWeight: '600' }],
        'body':    ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'caption': ['0.75rem',  { lineHeight: '1rem',    fontWeight: '400' }],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
