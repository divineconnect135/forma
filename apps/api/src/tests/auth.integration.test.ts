import mongoose from "mongoose";
import request from "supertest";

import { MongoMemoryServer } from "mongodb-memory-server";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import { User } from "../models/User.js";

let mongoServer: MongoMemoryServer;

const validCustomer = {
  name: "Test Customer",
  email: "customer@example.com",
  password: "SecureTestPassword123!",
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri("forma_auth_test"));

  await User.init();
}, 120_000);

beforeEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe("Authentication API", () => {
  it("rejects registration without a CSRF token", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(validCustomer);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_CSRF_TOKEN");
  });

  it("registers a customer and creates a session", async () => {
    const agent = request.agent(app);

    const csrfResponse = await agent.get("/api/auth/csrf");

    expect(csrfResponse.status).toBe(200);

    const response = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfResponse.body.csrfToken)
      .send(validCustomer);

    expect(response.status).toBe(201);

    expect(response.body.data.user).toMatchObject({
      name: "Test Customer",
      email: "customer@example.com",
      role: "customer",
    });

    expect(response.body.data.user.passwordHash).toBeUndefined();

    const meResponse = await agent.get("/api/auth/me");

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.email).toBe("customer@example.com");

    const savedUser = await User.findOne({
      email: validCustomer.email,
    }).select("+passwordHash");

    expect(savedUser).not.toBeNull();
    expect(savedUser?.passwordHash).not.toBe(validCustomer.password);
  });

  it("rejects invalid registration information", async () => {
    const agent = request.agent(app);

    const csrfResponse = await agent.get("/api/auth/csrf");

    const response = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfResponse.body.csrfToken)
      .send({
        name: "A",
        email: "not-an-email",
        password: "123",
      });

    expect(response.status).toBe(400);
  });

  it("prevents users from assigning the admin role", async () => {
    const agent = request.agent(app);

    const csrfResponse = await agent.get("/api/auth/csrf");

    const response = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfResponse.body.csrfToken)
      .send({
        ...validCustomer,
        role: "admin",
      });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate email registration", async () => {
    await User.create({
      name: validCustomer.name,
      email: validCustomer.email,
      passwordHash: "test-only-hash",
      role: "customer",
    });

    const agent = request.agent(app);

    const csrfResponse = await agent.get("/api/auth/csrf");

    const response = await agent
      .post("/api/auth/register")
      .set("X-CSRF-Token", csrfResponse.body.csrfToken)
      .send(validCustomer);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects unauthenticated profile access", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("logs in and logs out successfully", async () => {
    // Register a real customer first.
    const registerAgent = request.agent(app);

    const registerCsrf = await registerAgent.get("/api/auth/csrf");

    const registerResponse = await registerAgent
      .post("/api/auth/register")
      .set("X-CSRF-Token", registerCsrf.body.csrfToken)
      .send(validCustomer);

    expect(registerResponse.status).toBe(201);

    // Simulate a separate browser login session.
    const loginAgent = request.agent(app);

    const loginCsrf = await loginAgent.get("/api/auth/csrf");

    const loginResponse = await loginAgent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginCsrf.body.csrfToken)
      .send({
        email: validCustomer.email,
        password: validCustomer.password,
      });

    expect(loginResponse.status).toBe(200);

    const meResponse = await loginAgent.get("/api/auth/me");

    expect(meResponse.status).toBe(200);

    // Authentication rotates the CSRF token.
    const logoutCsrf = await loginAgent.get("/api/auth/csrf");

    const logoutResponse = await loginAgent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", logoutCsrf.body.csrfToken);

    expect(logoutResponse.status).toBe(204);

    const afterLogout = await loginAgent.get("/api/auth/me");

    expect(afterLogout.status).toBe(401);
  });

  it("rejects incorrect passwords", async () => {
    const registerAgent = request.agent(app);

    const registerCsrf = await registerAgent.get("/api/auth/csrf");

    await registerAgent
      .post("/api/auth/register")
      .set("X-CSRF-Token", registerCsrf.body.csrfToken)
      .send(validCustomer);

    const loginAgent = request.agent(app);

    const loginCsrf = await loginAgent.get("/api/auth/csrf");

    const response = await loginAgent
      .post("/api/auth/login")
      .set("X-CSRF-Token", loginCsrf.body.csrfToken)
      .send({
        email: validCustomer.email,
        password: "IncorrectPassword123!",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
