export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Array<"admin" | "coordinator" | "employee">;
};

type ApiError = { error?: { code?: string; message?: string } };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Something went wrong. Please try again.");
  }
  return payload;
}
