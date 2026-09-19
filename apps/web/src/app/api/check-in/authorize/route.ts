import { handleCheckInAuthorize } from "@/check-in/handlers";
import { loadCheckInDeps } from "@/check-in/production";
import { EntitlementError } from "@/entitlement/errors";
import { entitlementJson } from "@/entitlement/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleCheckInAuthorize(request, loadCheckInDeps(process.env));
  } catch (error) {
    if (error instanceof EntitlementError) {
      return entitlementJson(error.status, { error: error.code });
    }
    return entitlementJson(503, { error: "database_unconfigured" });
  }
}
