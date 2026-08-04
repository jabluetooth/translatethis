import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Courier_Prime, Special_Elite } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthConfigured } from "@/lib/auth";
import "./globals.css";

// Body copy: Courier Prime — a typewriter face refined for extended reading
// (originally built for screenplay writing), so long translated output
// stays comfortable to read despite the monospace texture.
const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Headings only: Special Elite — an actual distressed typewriter face, used
// sparingly (it's single-weight and a lot at body size) for character.
const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "TranslateThis — technical in, plain English out",
  description:
    "Paste text or drag in a file, pick an audience level and tone, and get a stakeholder-ready translation of your technical writing in seconds.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${courierPrime.variable} ${specialElite.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  if (!isAuthConfigured()) {
    return <Shell>{children}</Shell>;
  }

  // Clerk's own convention wraps <html> itself, not just <body> — it needs
  // control of the full document to inject its scripts.
  return (
    <ClerkProvider>
      <Shell>{children}</Shell>
    </ClerkProvider>
  );
}
