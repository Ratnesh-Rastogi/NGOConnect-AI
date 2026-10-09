import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
function secret() {
    const value = process.env.SESSION_SECRET;
    if (!value) {
        throw new Error("SESSION_SECRET must be configured");
    }
    return value;
}
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
export async function comparePassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}
export function signToken(payload) {
    return jwt.sign(payload, secret(), { expiresIn: "7d" });
}
export function verifyToken(token) {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded !== "object" ||
        decoded === null ||
        typeof decoded.sub !== "number" ||
        !["ngo", "donor", "admin"].includes(String(decoded.role))) {
        throw new Error("Invalid token payload");
    }
    return {
        sub: decoded.sub,
        role: decoded.role,
        ngoId: typeof decoded.ngoId === "number"
            ? decoded.ngoId
            : decoded.ngoId === null
                ? null
                : null,
    };
}
