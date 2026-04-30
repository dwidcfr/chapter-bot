import type { Metadata } from "next";
import Script from "next/script";
import Reader from "./Reader";

export const metadata: Metadata = {
  title: "The Secret Garden",
  description: "Read 'The Secret Garden' by Frances Hodgson Burnett.",
};

export default function ReadPage() {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
      />
      <Reader />
    </>
  );
}
