/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../frontend/index.html",
    "../frontend/src/**/*.js",
  ],
  safelist: [
    'bg-yellow-500',
    'bg-orange-500',
    'bg-red-600',
    'bg-purple-600',
    'bg-teal-600',
    'bg-amber-500',
    'bg-gray-400',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}