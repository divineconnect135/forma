export function formatUsd(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Amount must be an integer number of cents");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
