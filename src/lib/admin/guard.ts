import { NextResponse, type NextRequest } from "next/server";

/**
 * Guards `/admin*` requests. Stub: lets everything through.
 * Task 20 replaces the body with the Supabase session check.
 */
export async function adminGuard(request: NextRequest): Promise<NextResponse> {
  void request;
  return NextResponse.next();
}
