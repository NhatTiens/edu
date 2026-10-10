"use client";

import { useState } from 'react';

export function RetryButton() {
  const [pending, setPending] = useState(false);
  return <button className="btn btn-primary" disabled={pending} onClick={() => {
    setPending(true);
    // A fresh request also retries failed Server Components and layouts.
    window.location.reload();
  }}>{pending ? 'Đang tải lại…' : 'Thử lại'}</button>;
}
