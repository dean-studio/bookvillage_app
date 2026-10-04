import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  // 지점별 홈 화면 앱 이름 (Vercel 환경변수, 미지정 시 1호점)
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "자람도서관";
  return {
    name: appName,
    short_name: appName,
    description: `${appName} - 도서 대여/검색`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
