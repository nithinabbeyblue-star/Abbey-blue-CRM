"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type HRView = "attendance" | "leave" | "request" | null;

interface HRViewContextValue {
  activeView: HRView;
  setActiveView: (view: HRView) => void;
}

const HRViewContext = createContext<HRViewContextValue>({
  activeView: null,
  setActiveView: () => {},
});

export function HRViewProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<HRView>(null);
  return (
    <HRViewContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </HRViewContext.Provider>
  );
}

export function useHRView() {
  return useContext(HRViewContext);
}
