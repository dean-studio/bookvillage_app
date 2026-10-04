"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

// 회원카드용 QR (SVG, 인쇄 시 선명)
export function QrCodeSvg({ value, className }: { value: string; className?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg);
  }, [value]);

  return <div className={cn("[&>svg]:size-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
