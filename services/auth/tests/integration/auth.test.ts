import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../src/index.js";

const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `auth-int-${unique}@example.com`;
const dupEmail = `auth-dup-${unique}@example.com`;
const password = "password123";

describe("auth service (integration)", () => {
  let server: FastifyInstance;
  let refreshToken: string;
  let accessToken: string;

  beforeAll(async () => {
    server = await buildServer({ withPrisma: true });
    await server.ready();

    const res = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password, name: "Integration User" },
    });
    const body = res.json();
    refreshToken = body.refreshToken;
    accessToken = body.accessToken;
  });

  afterAll(async () => {
    await server.close();
  });

  it("POST /auth/register with a valid body returns 201 with tokens", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: dupEmail, password, name: "Reg User" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeTypeOf("string");
  });

  it("POST /auth/register with a duplicate email returns 409", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: dupEmail, password, name: "Reg User" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "Email already registered" });
  });

  it("POST /auth/login with valid credentials returns 200 with tokens", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeTypeOf("string");
  });

  it("POST /auth/login with a wrong password returns 401", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Invalid credentials" });
  });

  it("POST /auth/refresh with a valid refresh token returns 200 with a new access token", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTypeOf("string");
  });

  it("GET /auth/me with a valid access token returns 200 with the user", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe(email);
    expect(body.name).toBe("Integration User");
    expect(body.userId).toBeTypeOf("string");
  });

  it("GET /auth/me without a token returns 401", async () => {
    const res = await server.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Unauthorized" });
  });
});
