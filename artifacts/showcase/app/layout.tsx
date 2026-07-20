import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LetsLearnMoreOS | Playful learning, offline first",
  description:
    "The public project showcase and no-save demo for the open-source LetsLearnOS learning kiosk.",
  applicationName: "LetsLearnMoreOS (LLM OS)",
  keywords: [
    "open source education",
    "offline learning",
    "learning kiosk",
    "touch-first learning",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: "LetsLearnMoreOS | Playful learning, offline first",
    description:
      "Fourteen calm learning modules and a deterministic no-save demo.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#eff6ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
