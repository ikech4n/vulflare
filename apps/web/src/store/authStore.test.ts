import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    // ストアをリセット
    useAuthStore.setState({ user: null, accessToken: null });
  });

  it("should initialize with null user and token", () => {
    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });

  it("should set user and token on login", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      username: "testuser",
      role: "admin" as const,
    };
    const mockToken = "mock-token";

    useAuthStore.getState().login(mockToken, mockUser);

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(mockUser);
    expect(accessToken).toBe(mockToken);
  });

  it("should clear user and token on logout", () => {
    const mockUser = {
      id: "1",
      email: "test@example.com",
      username: "testuser",
      role: "admin" as const,
    };

    useAuthStore.getState().login("mock-token", mockUser);
    useAuthStore.getState().logout();

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });

  it("should update access token", () => {
    const newToken = "new-mock-token";

    useAuthStore.getState().setAccessToken(newToken);

    const { accessToken } = useAuthStore.getState();
    expect(accessToken).toBe(newToken);
  });
});
