import { ApiError, apiRequest } from "./http";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
}

interface AuthResponse {
  data: {
    user: AuthUser;
  };
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  const result = await apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return result.data.user;
}

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  const result = await apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return result.data.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const result = await apiRequest<AuthResponse>("/api/auth/me");

    return result.data.user;
  } catch (error) {
    // Being logged out is normal, not an application error.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await apiRequest<void>("/api/auth/logout", {
    method: "POST",
  });
}
