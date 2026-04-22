import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IM8 Influencer Portal",
  description: "IM8 Influencer Marketing Portal — manage creators, content, and campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="min-h-full antialiased">
      <body className="min-h-full bg-im8-burgundy">{children}</body>
    </html>
  );
}
