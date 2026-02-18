/**
 * Format an ISO date string into a human-readable local format.
 * e.g. "Feb 18, 23:59 IST" or "Feb 18, 18:29 EST"
 */
export function formatEndDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    const month = date.toLocaleString(undefined, { month: "short" });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    // Get timezone abbreviation
    const tz = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";

    return `${month} ${day}, ${hours}:${minutes} ${tz}`;
  } catch {
    return isoDate;
  }
}

/**
 * Get a countdown string from now until the given ISO date.
 * Returns e.g. "2d 5h 30m" or "5h 12m" or "12m" or "Ended"
 */
export function getCountdown(isoDate: string): string {
  try {
    const target = new Date(isoDate).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  } catch {
    return "";
  }
}
