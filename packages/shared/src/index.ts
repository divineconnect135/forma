export type HealthResponse = {
  status: "ok" | "degraded";
  database: "connected" | "disconnected";
};
