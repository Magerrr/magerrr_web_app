import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OfflineBanner, ServiceWorker } from "@/components/pwa";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  appleWebApp: {
    title: BRAND.name,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <OfflineBanner />
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
