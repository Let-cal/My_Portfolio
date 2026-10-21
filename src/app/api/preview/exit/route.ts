import { draftMode } from "next/headers";
import { previewDestination } from "@/lib/admin/preview";
export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`)
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  let destination: string;
  try {
    destination = previewDestination(url.searchParams);
  } catch {
    return new Response("Invalid destination", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  (await draftMode()).disable();
  // Relative Location preserves the actual browser origin behind Next/Vercel reverse proxies.
  return new Response(null, {
    status: 303,
    headers: { Location: destination, "Cache-Control": "private, no-store" },
  });
}
