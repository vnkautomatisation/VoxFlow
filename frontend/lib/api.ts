const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

interface ApiOptions {
  method?:  string
  body?:    any
  token?:   string
}

export async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = "Bearer " + token
  }

  const res = await fetch(API_URL + endpoint, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || "Erreur serveur")
  }

  return data
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<any>("/api/v1/auth/login", { method: "POST", body: { email, password } }),

  register: (body: any) =>
    apiRequest<any>("/api/v1/auth/register", { method: "POST", body }),

  me: (token: string) =>
    apiRequest<any>("/api/v1/auth/me", { token }),

  logout: (token: string) =>
    apiRequest<any>("/api/v1/auth/logout", { method: "POST", token }),

  refresh: () =>
    apiRequest<any>("/api/v1/auth/refresh", { method: "POST" }),
}
