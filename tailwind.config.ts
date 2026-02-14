import type { Config } from 'tailwindcss'

export default <Config>{
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      colors: {
        'pale-cashmere': '#e8dfd5',
        'cinnamon-ice': '#dbbba7',
        'burning-orange': '#ff7124',
        'blue-estate': '#3b4883',
        'wahoo': '#272d4e',
        'noble-black': '#202124',
        'cream': '#f9f3ec',
        'cinnabar-red': '#eb4335',
      },
      fontFamily: {
        geist: ['Geist', 'sans-serif'],
        rewon: ['Rewon', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
