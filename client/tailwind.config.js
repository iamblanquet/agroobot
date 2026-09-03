/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agrokool: {
          gold: '#a87d13',
          forest: '#2c4001',
          lime: '#a1c62e'
        },
        forest: {
          50: '#f4f8ed',
          100: '#e6f0d7',
          200: '#cee2b1',
          300: '#afd085',
          400: '#8ebc58',
          500: '#6ea434',
          600: '#528323',
          700: '#3e651a',
          800: '#2c4001', // Official #2c4001
          900: '#1e2d01',
          950: '#0e1700'
        },
        lime: {
          50: '#f8fced',
          100: '#eff7d5',
          200: '#e0efae',
          300: '#cbe47d',
          400: '#a1c62e', // Official #a1c62e
          500: '#88a822',
          600: '#6c8718',
          700: '#526815',
          800: '#435416',
          900: '#394717',
          950: '#1c2707'
        },
        gold: {
          50: '#fdfaf3',
          100: '#f9f2df',
          200: '#f3e3ba',
          300: '#ebd08d',
          400: '#dfb75c',
          500: '#cca035',
          600: '#a87d13', // Official #a87d13
          700: '#886212',
          800: '#704f15',
          900: '#5e4216',
          950: '#362409'
        },
        brand: {
          50: '#f4f8ed',
          100: '#e6f0d7',
          200: '#cee2b1',
          300: '#afd085',
          400: '#a1c62e',
          500: '#6ea434',
          600: '#528323',
          700: '#3e651a',
          800: '#2c4001',
          900: '#1e2d01',
          950: '#0e1700'
        },
        surface: {
          light: '#fbfcf8',
          card: '#ffffff',
          border: '#e4ebd6',
          muted: '#5c6b4b'
        }
      }
    },
  },
  plugins: [],
}
