type LoginResponse = {
  ok(): boolean;
  request(): { allHeaders(): Promise<Record<string, string>> };
};

/** Fail before transmission if the SSR verifier tries refresh, repair or a different API. */
export function assertReadOnlyUserRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  apiUrl: string,
) {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (
    url.origin !== apiUrl ||
    url.username ||
    url.password ||
    url.pathname !== "/auth/v1/user" ||
    url.search ||
    url.hash ||
    method !== "GET"
  )
    throw new Error("Only local read-only user verification is permitted");
}

/** Capture metadata, never a body tied to the document that login replaces. */
export async function captureLoginResponse(response: LoginResponse) {
  if (!response.ok()) return { ok: false } as const;
  const headers = await response.request().allHeaders();
  return { ok: true, apiKey: headers.apikey } as const;
}
