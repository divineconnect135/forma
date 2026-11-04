import { User } from "../models/User.js";
export const requireAdmin = async (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) {
        res.status(401).json({
            error: {
                code: "UNAUTHENTICATED",
                message: "Authentication required",
            },
        });
        return;
    }
    // Check the role in the database on every request.
    // Never accept the role from request body, query
    // parameters, or browser-controlled state.
    const administrator = await User.exists({
        _id: userId,
        active: true,
        role: "admin",
    });
    if (!administrator) {
        res.status(403).json({
            error: {
                code: "ADMIN_ACCESS_REQUIRED",
                message: "Administrator access required",
            },
        });
        return;
    }
    next();
};
