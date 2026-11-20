/**
 * Admin authorization.
 *
 * The role is read ONLY from `req.user`, which `requireAuth` populates from a
 * JWT whose signature it has already verified with the server-held secret.
 * Nothing in the request body, query, or any client-supplied field can
 * influence it — a client that edits a role it stores locally gains nothing,
 * because a modified token fails signature verification.
 *
 * Must be mounted AFTER `requireAuth`. If it is ever mounted alone, `req.user`
 * is undefined and this fails closed with 401 instead of passing the request.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.id === undefined || req.user.id === null) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.user.role !== "admin") {
    // Audit trail for denied privileged access. Never logs the token or body.
    console.warn(
      `[authz] admin access denied user=${req.user.id} role=${String(req.user.role)} ${req.method} ${req.originalUrl}`,
    );
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/**
 * Structured audit line for a successful privileged write. Logs who, what and
 * which record — never the request body, so no secrets or PII are written.
 */
export function auditAdminAction(req, action, targetId) {
  console.info(
    `[audit] admin=${req.user?.id} action=${action} target=${targetId ?? "-"} at=${new Date().toISOString()}`,
  );
}
