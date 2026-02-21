import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar"; // Assicurati che il path sia corretto

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ticket Tracker System",
  description: "Management Dashboard for Sprints and Tickets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex h-screen overflow-hidden bg-[#FBFBFB]`}
      >
        {/* SIDEBAR FISSA A SINISTRA */}
        <Sidebar />

        {/* AREA CONTENUTO PRINCIPALE SCROLLABILE */}
        <main className="flex-1 h-screen overflow-y-auto relative">
          {children}
        </main>
      </body>
    </html>
  );
}