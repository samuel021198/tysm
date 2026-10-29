"use client";

import { useEffect } from "react";
import { threadFrameBox } from "@/lib/thread-viewport";

/** Pins the fullscreen thread to the visible viewport so the notch, home indicator, and keyboard do not cover it. */
export function ThreadViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    let frame = 0;
    const apply = () => {
      const box = threadFrameBox({
        innerHeight: window.innerHeight,
        height: vv.height,
        offsetTop: vv.offsetTop,
        scale: vv.scale,
      });
      if (!box) {
        root.style.removeProperty("--vvh");
        root.style.removeProperty("--vv-top");
        delete root.dataset.threadKeyboard;
        delete root.dataset.threadOffset;
        return;
      }
      root.style.setProperty("--vvh", `${box.height}px`);
      root.style.setProperty("--vv-top", `${box.top}px`);
      if (box.keyboard) root.dataset.threadKeyboard = "open";
      else delete root.dataset.threadKeyboard;
      if (box.top > 0) root.dataset.threadOffset = "1";
      else delete root.dataset.threadOffset;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vv-top");
      delete root.dataset.threadKeyboard;
      delete root.dataset.threadOffset;
    };
  }, []);
  return null;
}
