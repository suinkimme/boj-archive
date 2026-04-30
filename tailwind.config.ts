import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#F9423A',
          dark: '#1C1F28',
          white: '#FFFFFF',
        },
        text: {
          primary: '#1C1F28',
          secondary: '#4A484C',
          muted: '#9B989A',
        },
        surface: {
          page: '#F5F5F5',
          card: '#FFFFFF',
          notice: '#FFF4F3',
          noticeDark: '#FFE9E7',
        },
        border: {
          DEFAULT: '#E4E3E5',
          key: '#CFCDCF',
          list: '#F0F0F1',
        },
        highlight: '#EB6B56',
        status: {
          success: { DEFAULT: '#1E8E3E', bg: '#E6F4EA' },
          warning: { DEFAULT: '#B06000', bg: '#FEF7E0' },
          danger: { DEFAULT: '#B3261E', bg: '#FCE8E6' },
        },
      },
      fontFamily: {
        sans: [
          'var(--font-noto-sans-kr)',
          "'Noto Sans KR'",
          "'본고딕'",
          "'Malgun Gothic'",
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
