/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ed: {
          orange:  '#ff7b00',
          gold:    '#e0a030',
          dark:    '#0a0c0f',
          panel:   '#111418',
          border:  '#1e2530',
          text:    '#c8d0d8',
          muted:   '#6b7888',
          danger:  '#cc3333',
          success: '#33cc66',
        },
      },
      fontFamily: {
        mono: ['Share Tech Mono', 'Consolas', 'monospace'],
        ui:   ['Exo 2', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
