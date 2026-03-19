import { verifySessionToken } from "@ops/auth";

/** Verify a JWT and return the decoded user. Used by dashboard middleware. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const user = verifySessionToken(token);
  if (!user) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    user: { username: user.email, role: user.roles?.[0]?.toLowerCase() ?? "unknown" },
  });
}
