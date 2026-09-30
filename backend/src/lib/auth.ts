import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export type AuthPayload = {
  sub: number;
  role: "ngo" | "donor" | "admin";
  ngoId: number | null;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET must be configured");
  }
  return value;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, secret());
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "number" ||
    !["ngo", "donor", "admin"].includes(String(decoded.role))
  ) {
    throw new Error("Invalid token payload");
  }
  return {
    sub: decoded.sub,
    role: decoded.role as AuthPayload["role"],
    ngoId:
      typeof decoded.ngoId === "number"
        ? decoded.ngoId
        : decoded.ngoId === null
          ? null
          : null,
  };
}