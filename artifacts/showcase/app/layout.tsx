import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LetsLearnOS | Playful learning, offline first",
  description:
    "An open-source, touch-first learning kiosk for families, educators, and contributors.",
  applicationName: "LetsLearnOS Playbook",
  keywords: [
    "open source education",
    "offline learning",
    "learning kiosk",
    "touch-first learning",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: "LetsLearnOS | Playful learning, offline first",
    description:
      "Fourteen calm, deterministic learning modules in one open-source kiosk.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#eef6eb",
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
