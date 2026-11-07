import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminSession } from "@/lib/admin-access";
import { adminApi, ApiError, isAdminAuthed, setAdminAuthed } from "@/lib/cms/client-store";

vi.mock("@/lib/cms/client-store", () => ({
  adminApi: vi.fn(), isAdminAuthed: vi.fn(), setAdminAuthed: vi.fn(),
  ApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));

describe("Admin dashboard access", () => {
  beforeEach(() => vi.resetAllMocks());
  it("blocks /admin when no session exists", async () => {
    vi.mocked(isAdminAuthed).mockReturnValue(false);
    await expect(requireAdminSession()).rejects.toMatchObject({ options: { to: "/admin/login" } });
    expect(adminApi).not.toHaveBeenCalled();
  });
  it("blocks an invalid stored session", async () => {
    vi.mocked(isAdminAuthed).mockReturnValue(true);
    vi.mocked(adminApi).mockRejectedValue(new ApiError("Unauthorized", 401));
    await expect(requireAdminSession()).rejects.toMatchObject({ options: { to: "/admin/login" } });
    expect(setAdminAuthed).toHaveBeenCalledWith(false);
  });
  it("allows a session validated by the protected API", async () => {
    vi.mocked(isAdminAuthed).mockReturnValue(true);
    vi.mocked(adminApi).mockResolvedValue({ categories: [] });
    await expect(requireAdminSession()).resolves.toBeUndefined();
    expect(adminApi).toHaveBeenCalledWith("/admin/courses");
  });
});