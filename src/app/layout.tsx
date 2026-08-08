import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lintos — ניהול תשלומים",
  description: "מערכת CRM לניהול תשלומים — קישורי תשלום, חיובים, חשבוניות וטוקנים.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-left" closeButton />
      </body>
    </html>
  );
}
