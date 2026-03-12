export type UserRole = "admin" | "editor" | "viewer";

export type Theme = "light" | "dark" | "system";

export interface MeResponse {
  id: string;
  username: string;
  role: UserRole;
  theme: Theme;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: Pick<User, "id" | "username" | "role">;
}
