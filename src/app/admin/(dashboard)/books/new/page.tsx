"use client";

import dynamic from "next/dynamic";

const ShelfGrid = dynamic(
  () => import("./shelf-grid").then((mod) => ({ default: mod.ShelfGrid })),
  { ssr: false }
);

const MobileRegister = dynamic(
  () =>
    import("./mobile-register").then((mod) => ({
      default: mod.MobileRegister,
    })),
  { ssr: false }
);

export default function AdminBooksNewPage() {
  return (
    <>
      <div className="hidden md:block">
        <ShelfGrid />
      </div>
      <div className="md:hidden">
        <MobileRegister />
      </div>
    </>
  );
}
