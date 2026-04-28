import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        im8: {
          // Core brand (unchanged)
          burgundy:  '#50000B',
          red:       '#A40011',
          flamingo:  '#FF9693',
          stone:     '#E1CBB9',
          // Updated to V4.01 spec
          sand:      '#F5EDE0',   // was #FFE9D8 — now V4 "Cream"
          offwhite:  '#FAF6F2',   // was #F5EAEA — now V4 "Off White"
          // New V4.01 tokens
          gold:      '#C5973B',   // stat numbers, premium accents
          dark:      '#3D0010',   // Dark Burgundy, extra depth
          // Text colour system (V4: "all text must use one of these 4 values")
          maroon:    '#5A000B',   // headline text (Deep Maroon)
          ink:       '#1A0508',   // body copy (Near Black)
          muted:     '#8C7A6E',   // supporting text / captions (Warm Gray)
        },
      },
    },
  },
  plugins: [],
};

export default config;
