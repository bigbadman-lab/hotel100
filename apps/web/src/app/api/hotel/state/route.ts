import { handlePublicHotelState } from "@/hotel/public-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handlePublicHotelState(request, process.env);
}
