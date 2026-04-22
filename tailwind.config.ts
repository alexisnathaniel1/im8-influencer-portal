import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        im8: {
          burgundy: '#50000B',
          red: '#A40011',
          flamingo: '#FF9693',
          stone: '#E1CBB9',
          sand: '#FFE9D8',
          offwhite: '#F5EAEA',
        },
      },
    },
  },
  plugins: [],
};

export default config;
