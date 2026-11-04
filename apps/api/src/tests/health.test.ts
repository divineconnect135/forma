import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("health routes", () => {
  it("responds to the liveness endpoint", async () => {
    const response = await request(app).get("/api/health/live");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
  it("reports MongoDB disconnected before a database connection is made", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
  });
  it("returns a consistent 404 error", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
