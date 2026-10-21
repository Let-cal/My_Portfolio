import { draftMode } from "next/headers";
import { requireAdmin } from "@/lib/admin/session";
import { previewDestination } from "@/lib/admin/preview";
export async function GET(request: Request) {
  let destination: string;
  try {
    destination = previewDestination(new URL(request.url).searchParams);
  } catch {
    return new Response("Invalid preview destination", {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    await requireAdmin();
  } catch (error) {
    return new Response("Admin authentication required", {
      status:
        error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  (await draftMode()).enable();
  return new Response(null, {
    status: 307,
    headers: { Location: destination, "Cache-Control": "private, no-store" },
  });
}
