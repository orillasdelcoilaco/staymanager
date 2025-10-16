/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "../frontend/index.html",
    "../frontend/src/**/*.js",
    "./views/**/*.ejs", // <-- AÑADIR ESTA LÍNEA
  ],
  safelist: [
    // ... (safelist existente)
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}