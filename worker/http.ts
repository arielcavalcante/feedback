export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export async function readJson<T>(request: Request, maxBytes = 8_192): Promise<T> {
  const length = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
  if (length > maxBytes) throw new HttpError(413, "payload_too_large", "Request is too large.");
  try { return await request.json<T>(); }
  catch { throw new HttpError(400, "invalid_json", "The request body is invalid."); }
}

export function assertSameOrigin(request: Request, expectedOrigin: string): void {
  const origin = request.headers.get("Origin");
  if (origin !== expectedOrigin) throw new HttpError(403, "invalid_origin", "Request origin is not allowed.");
}
