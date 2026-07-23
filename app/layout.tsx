import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const nightModeBootstrap = `(function(){var night=new Date().getHours()>=18;try{var saved=localStorage.getItem("storygen2-night-mode");if(saved)night=saved==="night";}catch(e){}if(night)document.documentElement.classList.add("storygen-night");})();`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const title = "StoryGen — personalized bedtime stories";
  const description = "Your child’s drawing or brick build comes alive in a warm, illustrated bedtime adventure.";
  const socialImage = new URL("/og-storygen-night.png", base).toString();

  return {
    metadataBase: base,
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", images: [{ url: socialImage, width: 1200, height: 630, alt: "A child’s brick-car drawing rolling into an illustrated bedtime story" }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: nightModeBootstrap }} /></head>
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
