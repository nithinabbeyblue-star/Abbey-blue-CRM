"use client";

import { HRViewProvider } from "./hr-view-context";
import { HRViewOverlay } from "./hr-view-overlay";

export function HRLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <HRViewProvider>
      {children}
    </HRViewProvider>
  );
}

export function HRMainContent({ children }: { children: React.ReactNode }) {
  return <HRViewOverlay>{children}</HRViewOverlay>;
}
