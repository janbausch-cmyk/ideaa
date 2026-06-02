import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
  "https://ideaa.app";

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
  title: "IDEAA — paste an idea, get a validation report",
  description:
    "Turn raw ideas into validated, actionable business opportunities with AI-assisted analysis and implementation planning.",
  openGraph: {
    title: "IDEAA — paste an idea, get a validation report",
    description:
      "Turn raw ideas into validated, actionable business opportunities with AI-assisted analysis and implementation planning.",
    siteName: "IDEAA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "IDEAA — paste an idea, get a validation report",
    description:
      "Turn raw ideas into validated, actionable business opportunities with AI-assisted analysis and implementation planning.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
