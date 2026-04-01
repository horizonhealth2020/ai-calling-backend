/** Format a number as $X,XXX.XX (always positive, 2 decimal places) */
export function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format an ISO date string as M/D/YYYY (no leading zeros). Returns "--" for null/undefined. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "--";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${parseInt(m)}/${parseInt(dd)}/${y}`;
}

/** Format an ISO date string as M/D/YYYY h:mm AM/PM. Returns "--" for null/undefined. */
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "--";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
