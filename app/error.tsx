"use client";

import { useEffect, useState } from "react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [zh, setZh] = useState(true);
  useEffect(() => setZh(document.documentElement.lang.startsWith("zh")), []);
  return (
    <div className="grid gap-3">
      <p>{zh ? "頁面暫時載入唔到。" : "This page could not be loaded."}</p>
      <button className="btn btn-primary w-fit" onClick={() => reset()}>
        {zh ? "再試一次" : "Try again"}
      </button>
    </div>
  );
}
