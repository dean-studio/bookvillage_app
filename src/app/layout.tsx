import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getPublicSettings } from "@/app/actions/settings";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();

  const title = settings.og_title || "책빌리지";
  const description = settings.og_description || "아파트 스마트 작은도서관 관리 및 독서 커뮤니티";
  const ogImage = settings.og_image_url || settings.logo_url;
  const apartmentName = settings.apartment_name;

  return {
    title: {
      default: apartmentName ? `${title} - ${apartmentName}` : title,
      template: `%s | ${title}`,
    },
    description,
    openGraph: {
      title: apartmentName ? `${title} - ${apartmentName}` : title,
      description,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
