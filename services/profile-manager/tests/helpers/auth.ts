import jwt from "jsonwebtoken";
import { buildServer as buildAuthServer } from "auth";

const DEFAULT_USER_ID = "10000000-0000-0000-0000-000000000001";

// Signs a user JWT the same way services/auth/ does ({ sub, email }), for use
// in integration requests against JWT-protected endpoints.
export function bearer(
  userId: string = DEFAULT_USER_ID,
  email = "tester@example.com",
): { authorization: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in the test environment");
  }
  const token = jwt.sign({ sub: userId, email }, secret, { expiresIn: "1h" });
  return { authorization: `Bearer ${token}` };
}

// Creates a real User through the auth service (which owns identity and password
// hashing) and returns a usable access token. Used when a test needs a User row
// that profile-manager can resolve — without profile-manager ever touching the
// password column. Idempotent across runs: falls back to login if the user
// already exists.
export async function realAccessToken(
  email: string,
  name: string,
  password = "test-password-123",
): Promise<string> {
  const auth = await buildAuthServer({ withPrisma: true });
  await auth.ready();
  try {
    let res = await auth.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password, name },
    });
    if (res.statusCode !== 201) {
      res = await auth.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password },
      });
    }
    return res.json().accessToken as string;
  } finally {
    await auth.close();
  }
}
