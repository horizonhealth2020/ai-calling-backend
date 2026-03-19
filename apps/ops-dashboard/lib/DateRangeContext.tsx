"use client";
import { createContext, useContext, useState } from "react";
import type { DateRangeFilterValue } from "@ops/ui";

interface DateRangeContextValue {
  value: DateRangeFilterValue;
  onChange: (v: DateRangeFilterValue) => void;
}

const DateRangeContext = createContext<DateRangeContextValue>({
  value: { preset: "week" },
  onChange: () => {},
});

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<DateRangeFilterValue>({ preset: "week" });
  return (
    <DateRangeContext.Provider value={{ value, onChange: setValue }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export const useDateRange = () => useContext(DateRangeContext);
