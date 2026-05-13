import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Rippling · Bulk Change",
  description: "AI-powered bulk employee attribute updates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex bg-gray-50 antialiased">
        <Nav />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
