const numberFormats = new Map<number, Intl.NumberFormat>();
export function formatterFor(decimals: number) {
  let formatter = numberFormats.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, formatter);
  }
  return formatter;
}

export function decimalsOf(n: number) {
  const s = String(n);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}


export function formatTickerValue(value: number, prefix = "", suffix = "") {
  return `${prefix}${formatterFor(decimalsOf(value)).format(value)}${suffix}`;
}
