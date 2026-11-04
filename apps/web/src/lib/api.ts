import type { HealthResponse } from "@forma/shared";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error(`API unavailable: ${response.status}`);
  return (await response.json()) as HealthResponse;
}
