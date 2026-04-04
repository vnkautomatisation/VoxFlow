/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        voxflow: {
          purple: '#534AB7',
          teal:   '#0F6E56',
          blue:   '#185FA5',
          coral:  '#993C1D',
        },
      },
    },
  },
  plugins: [],
}
