import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Outfyt — your closet. your aesthetic. your way.", description: "A personal AI styling studio for the clothes you already own." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
