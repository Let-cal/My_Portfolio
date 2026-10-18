/** CSS Unicode ranges, including wildcard notation, expanded for build-time validation. */
export function unicodePoints(range) {
  const points = new Set();
  for (const raw of range.split(",")) {
    const value = raw.trim().replace(/^u\+/i, "");
    const bounds = value.includes("?")
      ? [value.replaceAll("?", "0"), value.replaceAll("?", "f")]
      : value.split("-");
    const start = parseInt(bounds[0], 16), end = parseInt(bounds[1] ?? bounds[0], 16);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end > 0x10ffff) throw new Error(`Invalid Unicode range: ${raw}`);
    for (let point = start; point <= end; point++) points.add(point);
  }
  return points;
}

export function subtractUnicodeRange(range, excluded) {
  const omit = unicodePoints(excluded);
  const points = [...unicodePoints(range)].filter(point => !omit.has(point)).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    let end = start;
    while (points[i + 1] === end + 1) end = points[++i];
    result.push(`u+${start.toString(16)}${end === start ? "" : `-${end.toString(16)}`}`);
  }
  return result.join(",");
}
