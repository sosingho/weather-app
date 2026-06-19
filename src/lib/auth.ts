import { getAdminToken, getCronSecret } from "./config";

export type AuthResult = {
  ok: boolean;
  status: number;
  error?: string;
};

export function authorizeCronRequest(request: Request): AuthResult {
  return authorizeRequest(request, getCronSecret(), "CRON_SECRET");
}

export function authorizeAdminRequest(request: Request): AuthResult {
  return authorizeRequest(request, getAdminToken(), "ADMIN_TOKEN");
}

function authorizeRequest(request: Request, expectedSecret: string | null, envName: string): AuthResult {
  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      error: `${envName} is not configured.`,
    };
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-app-secret");
  const bearerSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (bearerSecret === expectedSecret || headerSecret === expectedSecret) {
    return { ok: true, status: 200 };
  }

  return {
    ok: false,
    status: 401,
    error: "Unauthorized.",
  };
}
