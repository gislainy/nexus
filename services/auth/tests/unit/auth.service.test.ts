import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import {
  createAuthService,
  type AuthService,
} from "../../src/services/auth.service.js";
import type { UserRepository } from "../../src/repositories/user.repository.js";

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}

interface FakeRefreshToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

function makeRepository(seed: {
  users?: FakeUser[];
  tokens?: FakeRefreshToken[];
}): UserRepository {
  const users: FakeUser[] = [...(seed.users ?? [])];
  const tokens: FakeRefreshToken[] = [...(seed.tokens ?? [])];
  let counter = users.length;

  return {
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      const user = users.find((u) => u.id === id);
      return user ? { id: user.id, email: user.email, name: user.name } : null;
    },
    async create(input) {
      counter += 1;
      const id = `user-${counter}`;
      users.push({ id, ...input });
      return { id };
    },
    async saveRefreshToken(userId, token, expiresAt) {
      tokens.push({ userId, token, expiresAt });
    },
    async findRefreshToken(token) {
      const record = tokens.find((t) => t.token === token);
      return record
        ? { userId: record.userId, expiresAt: record.expiresAt }
        : null;
    },
    async deleteRefreshToken(token) {
      const idx = tokens.findIndex((t) => t.token === token);
      if (idx >= 0) tokens.splice(idx, 1);
    },
  };
}

function makeService(seed: {
  users?: FakeUser[];
  tokens?: FakeRefreshToken[];
} = {}): AuthService {
  return createAuthService(makeRepository(seed));
}

describe("AuthService (unit)", () => {
  it("register with a new email returns access and refresh tokens", async () => {
    const service = makeService();
    const tokens = await service.register({
      email: "new@example.com",
      password: "password123",
      name: "New User",
    });
    expect(tokens.accessToken).toBeTypeOf("string");
    expect(tokens.refreshToken).toBeTypeOf("string");
    expect(tokens.accessToken.length).toBeGreaterThan(0);
    expect(tokens.refreshToken.length).toBeGreaterThan(0);
  });

  it("register with a duplicate email throws", async () => {
    const service = makeService({
      users: [
        {
          id: "user-1",
          email: "taken@example.com",
          passwordHash: "x",
          name: "Taken",
        },
      ],
    });
    await expect(
      service.register({
        email: "taken@example.com",
        password: "password123",
        name: "Dup",
      }),
    ).rejects.toThrow("Email already registered");
  });

  it("login with valid credentials returns tokens", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const service = makeService({
      users: [
        {
          id: "user-1",
          email: "user@example.com",
          passwordHash,
          name: "User",
        },
      ],
    });
    const tokens = await service.login({
      email: "user@example.com",
      password: "password123",
    });
    expect(tokens.accessToken).toBeTypeOf("string");
    expect(tokens.refreshToken).toBeTypeOf("string");
  });

  it("login with a non-existent email throws Invalid credentials", async () => {
    const service = makeService();
    await expect(
      service.login({ email: "missing@example.com", password: "whatever1" }),
    ).rejects.toThrow("Invalid credentials");
  });

  it("login with a wrong password throws Invalid credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const service = makeService({
      users: [
        {
          id: "user-1",
          email: "user@example.com",
          passwordHash,
          name: "User",
        },
      ],
    });
    await expect(
      service.login({ email: "user@example.com", password: "wrongpass1" }),
    ).rejects.toThrow("Invalid credentials");
  });

  it("refresh with a valid token returns a new access token", async () => {
    const service = makeService({
      users: [
        {
          id: "user-1",
          email: "user@example.com",
          passwordHash: "x",
          name: "User",
        },
      ],
      tokens: [
        {
          userId: "user-1",
          token: "valid-token",
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });
    const result = await service.refresh("valid-token");
    expect(result.accessToken).toBeTypeOf("string");
    expect(result.accessToken.length).toBeGreaterThan(0);
  });

  it("refresh with an expired token throws Refresh token expired", async () => {
    const service = makeService({
      users: [
        {
          id: "user-1",
          email: "user@example.com",
          passwordHash: "x",
          name: "User",
        },
      ],
      tokens: [
        {
          userId: "user-1",
          token: "expired-token",
          expiresAt: new Date(Date.now() - 60_000),
        },
      ],
    });
    await expect(service.refresh("expired-token")).rejects.toThrow(
      "Refresh token expired",
    );
  });

  it("refresh with a non-existent token throws Invalid refresh token", async () => {
    const service = makeService();
    await expect(service.refresh("nope")).rejects.toThrow(
      "Invalid refresh token",
    );
  });
});
