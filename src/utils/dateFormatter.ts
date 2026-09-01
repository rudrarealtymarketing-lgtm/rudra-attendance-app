/**
 * Formats database timestamps (SQLite CURRENT_TIMESTAMP or ISO strings) into a clean, human-readable
 * Indian Standard format: "31 Aug 2026, 03:45 PM"
 */
export function formatRequestDateTime(dateStr?: string | null): string {
  if (!dateStr) return '--';
  try {
    let isoStr = dateStr.trim();
    if (!isoStr.includes('T')) {
      isoStr = isoStr.replace(' ', 'T') + (isoStr.endsWith('Z') ? '' : 'Z');
    } else if (!isoStr.endsWith('Z') && !isoStr.includes('+') && !isoStr.includes('-')) {
      isoStr = isoStr + 'Z';
    }

    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
      const fallback = new Date(dateStr);
      if (!isNaN(fallback.getTime())) {
        return fallback.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      return dateStr;
    }

    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return dateStr || '--';
  }
}
