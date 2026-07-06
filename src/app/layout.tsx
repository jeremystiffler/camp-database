import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, DM_Mono } from "next/font/google";
import { HelpModeProvider } from "@/components/HelpMode";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Simple Schedule Pro — Program Management Platform",
  description:
    "Simple Schedule Pro — registrations, scheduling, check-in, and print materials for youth programs, workshops, leagues, and classes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body
        className={`${dmSans.className} min-h-screen bg-[#0B1622] text-[#F4E9D6] selection:bg-[#F0894A]/30 selection:text-[#F4E9D6]`}
      >
        <HelpModeProvider>{children}</HelpModeProvider>
      </body>
    </html>
  );
}
