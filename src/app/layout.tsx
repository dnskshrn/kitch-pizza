import type { Metadata } from "next";
import "./globals.css";
import { Inter, Roboto_Mono } from "next/font/google";
import { headers } from "next/headers";
import { getBrandByHost, getBrandBySlug } from "@/brands";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  variable: "--font-sans",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const brandSlug = headersList.get("x-brand-slug");
  const host =
    headersList.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headersList.get("host") ??
    "";
  const brand = brandSlug ? getBrandBySlug(brandSlug) : getBrandByHost(host);

  return {
    title: "Food Service POS",
    description: "Система управления заказами",
    icons: {
      icon: [{ url: brand.logo, type: "image/svg+xml" }],
      shortcut: [{ url: brand.logo, type: "image/svg+xml" }],
      apple: [{ url: brand.logo, type: "image/svg+xml" }],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={cn(inter.variable, robotoMono.variable)}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
