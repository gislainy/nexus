import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import type {
  AuthTokens,
  AuthUser,
  LoginInput,
  RegisterInput,
} from "@nexus/types";
import type { UserRepository } from "../repositories/user.repository.js";

export interface AuthService {
  register(input: RegisterInput): Promise<AuthTokens>;
  login(input: LoginInput): Promise<AuthTokens>;
  refresh(refreshToken: string): Promise<{ accessToken: string }>;
  getUser(userId: string): Promise<AuthUser>;
}

const SALT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? "1h";
}

function getRefreshTokenExpiresDays(): number {
  return Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "7");
}

function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn() as jwt.SignOptions["expiresIn"],
  });
}

export function createAuthService(repository: UserRepository): AuthService {
  async function issueTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const accessToken = signAccessToken(userId, email);
    const refreshToken = uuidv4();
    const expiresAt = new Date(
      Date.now() + getRefreshTokenExpiresDays() * 24 * 60 * 60 * 1000,
    );
    await repository.saveRefreshToken(userId, refreshToken, expiresAt);
    return { accessToken, refreshToken };
  }

  return {
    async register(input) {
      const existing = await repository.findByEmail(input.email);
      if (existing) {
        throw new Error("Email already registered");
      }
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      const user = await repository.create({
        email: input.email,
        passwordHash,
        name: input.name,
      });
      return issueTokens(user.id, input.email);
    },

    async login(input) {
      const user = await repository.findByEmail(input.email);
      if (!user) {
        throw new Error("Invalid credentials");
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new Error("Invalid credentials");
      }
      return issueTokens(user.id, user.email);
    },

    async refresh(refreshToken) {
      const record = await repository.findRefreshToken(refreshToken);
      if (!record) {
        throw new Error("Invalid refresh token");
      }
      if (record.expiresAt.getTime() < Date.now()) {
        throw new Error("Refresh token expired");
      }
      const user = await repository.findById(record.userId);
      if (!user) {
        throw new Error("Invalid refresh token");
      }
      const accessToken = signAccessToken(user.id, user.email);
      return { accessToken };
    },

    async getUser(userId) {
      const user = await repository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }
      return { userId: user.id, email: user.email, name: user.name };
    },
  };
}
