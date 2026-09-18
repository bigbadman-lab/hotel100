import { EntitlementError } from "@/entitlement/errors";
import { handleEntitlement } from "@/entitlement/handlers";
import { entitlementJson } from "@/entitlement/headers";
import { loadEntitlementDeps } from "@/entitlement/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return await handleEntitlement(request, loadEntitlementDeps(process.env));
  } catch (error) {
    if (error instanceof EntitlementError) {
      return entitlementJson(error.status, { error: error.code });
    }
    return entitlementJson(503, { error: "database_unconfigured" });
  }
}
