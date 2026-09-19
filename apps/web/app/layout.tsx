import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { colors, toCssDeclarations } from "@giroweg/shared/tokens";
import { Providers } from "@/app-providers";
import { themeInitScript } from "@/theme/theme-script";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GiroWeg",
  description: "Registro de kilometraje fiable para tu flota.",
  applicationName: "GiroWeg",
  appleWebApp: { capable: true, title: "GiroWeg", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: colors.dark.bg },
    { media: "(prefers-color-scheme: light)", color: colors.light.bg },
  ],
};

/** Design tokens as CSS custom properties, generated from packages/shared. */
const tokenStyles = `:root,[data-theme="dark"]{${toCssDeclarations("dark")}}[data-theme="light"]{${toCssDeclarations("light")}}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es"
      data-theme="dark"
      className={`${spaceGrotesk.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <style id="gw-tokens">{tokenStyles}</style>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg text-text">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
