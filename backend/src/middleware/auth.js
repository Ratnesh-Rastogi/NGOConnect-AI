import { verifyToken } from "../utils/auth.js";
export function authenticate(req, res, next) {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }
    try {
        req.auth = verifyToken(header.slice("Bearer ".length));
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.auth || !roles.includes(req.auth.role)) {
            res.status(403).json({ error: "You do not have permission for this action" });
            return;
        }
        next();
    };
}
