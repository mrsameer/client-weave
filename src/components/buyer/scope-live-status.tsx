"use client";

import { useEffect, useRef } from "react";

export function ScopeLiveStatus({
  message,
  urgent = false
}: {
  message: string;
  urgent?: boolean;
}) {
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (urgent && message) status.current?.focus();
  }, [message, urgent]);
  return (
    <p
      ref={status}
      tabIndex={-1}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
    >
      {message}
    </p>
  );
}
