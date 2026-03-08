import {
  Lato,
  Montserrat,
  Open_Sans,
  Oswald,
  Poppins,
  Raleway,
  Roboto,
  Roboto_Condensed,
  Roboto_Slab,
  Source_Sans_3,
} from "next/font/google";

const openSans = Open_Sans({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-open-sans",
  weight: ["400", "700"],
});

const roboto = Roboto({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-roboto",
  weight: ["400", "700"],
});

const montserrat = Montserrat({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-montserrat",
  weight: ["400", "700"],
});

const lato = Lato({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-lato",
  weight: ["400", "700"],
});

const robotoSlab = Roboto_Slab({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-roboto-slab",
  weight: ["400", "700"],
});

const poppins = Poppins({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-poppins",
  weight: ["400", "700"],
});

const sourceSans3 = Source_Sans_3({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-source-sans-3",
  weight: ["400", "700"],
});

const raleway = Raleway({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-raleway",
  weight: ["400", "700"],
});

const oswald = Oswald({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-oswald",
  weight: ["400", "700"],
});

const robotoCondensed = Roboto_Condensed({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-sheet-roboto-condensed",
  weight: ["400", "700"],
});

export const spreadsheetGoogleFontVariables = [
  openSans.variable,
  roboto.variable,
  montserrat.variable,
  lato.variable,
  robotoSlab.variable,
  poppins.variable,
  sourceSans3.variable,
  raleway.variable,
  oswald.variable,
  robotoCondensed.variable,
].join(" ");
