"use client";

import { Button } from "@/components/ui";

export function RetryButton() {
  return (
    <Button size="lg" onClick={() => window.location.reload()}>
      Coba lagi
    </Button>
  );
}
