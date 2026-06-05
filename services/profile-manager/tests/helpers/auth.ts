import jwt from "jsonwebtoken";

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
