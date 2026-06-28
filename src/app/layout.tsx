import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getPublicSettings } from "@/app/actions/settings";
import { getThemeById } from "@/lib/themes";
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

  const apartmentName = settings.apartment_name;
  const title = settings.og_title || apartmentName || "작은도서관";
  const description = settings.og_description || "스마트 작은도서관 관리 및 독서 커뮤니티";
  const ogImage = settings.og_image_url || settings.logo_url;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    openGraph: {
      title,
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getPublicSettings();
  const theme = getThemeById(settings.color_theme || "yellow");
  const lightVars = theme && theme.id !== "yellow" ? theme.light : {};
  const darkVars = theme && theme.id !== "yellow" ? theme.dark : {};
  const styleString =
    Object.keys(lightVars).length > 0
      ? Object.entries(lightVars)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")
      : undefined;
  const darkStyleString =
    Object.keys(darkVars).length > 0
      ? Object.entries(darkVars)
          .map(([k, v]) => `${k}:${v}`)
          .join(";")
      : undefined;

  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
      data-theme={settings.color_theme || "yellow"}
      style={styleString ? (Object.fromEntries(Object.entries(lightVars)) as React.CSSProperties) : undefined}
    >
      {darkStyleString && (
        <head>
          <style dangerouslySetInnerHTML={{ __html: `.dark{${darkStyleString}}` }} />
        </head>
      )}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
