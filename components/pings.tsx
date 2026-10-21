"use client";

import { useEffect } from "react";
import { pingView, markThreadRead } from "@/actions/social";

export function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    void pingView(id);
  }, [id]);
  return null;
}

export function ReadPing({ id }: { id: string }) {
  useEffect(() => {
    void markThreadRead(id);
  }, [id]);
  return null;
}
