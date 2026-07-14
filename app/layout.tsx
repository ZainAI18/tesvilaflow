import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tesvila Operations",
  description: "Invoice, delivery order, sales and inventory management for Tesvila Pte Ltd",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
