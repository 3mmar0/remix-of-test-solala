import { redirect } from "@tanstack/react-router";
import { adminApi, ApiError, isAdminAuthed, setAdminAuthed } from "@/lib/cms/client-store";

/** Verify the stored session against an existing protected API, not just token presence. */
export async function requireAdminSession() {
  if (!isAdminAuthed()) throw redirect({ to: "/admin/login" });
  try {
    await adminApi("/admin/courses");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      setAdminAuthed(false);
      throw redirect({ to: "/admin/login" });
    }
    throw error;
  }
}