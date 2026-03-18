export const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(JSON.stringify({ level: "info", event, payload, ts: new Date().toISOString() }));
};

export const logError = (event: string, payload: Record<string, unknown>) => {
  console.error(JSON.stringify({ level: "error", event, payload, ts: new Date().toISOString() }));
};

/** Format a number as $X,XXX.XX (always positive, 2 decimal places) */
export function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a negative dollar as -$X,XXX.XX */
export function formatNegDollar(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `-$${abs}`;
}

/** Format an ISO date string as M/D/YYYY (no leading zeros). Returns "--" for null/undefined. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "--";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${parseInt(m)}/${parseInt(dd)}/${y}`;
}
