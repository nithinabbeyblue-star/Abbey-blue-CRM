"use client";

import { useState, useMemo } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from "@headlessui/react";
import {
  CASE_CONFIG,
  getAllCaseTypes,
  type CaseTypeKey,
} from "@/constants/cases";

export function CaseDropdown({
  value,
  onChange,
}: {
  value: CaseTypeKey | null;
  onChange: (value: CaseTypeKey | null) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const all = getAllCaseTypes();
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.shortCode.toLowerCase().includes(q)
    );
  }, [query]);

  const selectedConfig = value ? CASE_CONFIG[value] : null;

  return (
    <Combobox
      value={value}
      onChange={(val) => {
        onChange(val);
        setQuery("");
      }}
    >
      <div className="relative">
        <ComboboxInput
          className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          displayValue={() => selectedConfig?.label ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search or select a case type..."
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-3 text-muted">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </ComboboxButton>

        <ComboboxOptions className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No results found.</p>
          ) : (
            filtered.map((item) => (
              <ComboboxOption
                key={item.key}
                value={item.key}
                className="cursor-pointer px-4 py-2.5 text-sm text-foreground data-[focus]:bg-primary/5 data-[focus]:text-primary"
              >
                {({ selected }) => (
                  <span className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${item.badgeBg.replace("100", "400")}`} />
                    <span className={selected ? "font-medium" : ""}>{item.label}</span>
                    {selected && (
                      <svg className="ml-auto h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                )}
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
