import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    colors: {
      paper: "#F3F2EE",
      paperRaised: "#F7F6F2",
      paperSunk: "#EBE8E1",
      rule: "#D9D6CE",
      ruleSoft: "#E0DDD5",
      ink: "#0F2230",
      navy: "#142F40",
      muted: "#4A5A64",
      rose: "#A6445D",
      olive: "#393A10",
      teal: "#62929E",
      tealDeep: "#3E6E7A",
      creme: "#E7DECD",
      onDark: "#F3F1EC",
      tealLight: "#9FC1C9",
      disabled: "#C9C5BC",
    },
    fontFamily: { serif: ["Times New Roman", "Times", "Tinos", "serif"] },
    extend: {},
  },
} satisfies Config;
