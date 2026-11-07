import { queryOptions } from "@tanstack/react-query";
import { adminApi } from "@/lib/cms/client-store";
import { coursesApi } from "@/lib/courses-admin";

export type DashboardRegistration = { id: number; full_name: string; course_title: string; created_at: string; state: string };
type RegistrationResponse = { registrations: { data: DashboardRegistration[]; total: number } };

export const adminDashboardOptions = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: async () => {
    const [catalog, registrations, newRegistrations] = await Promise.all([
      coursesApi.list(),
      adminApi<RegistrationResponse>("/admin/course-registrations"),
      adminApi<RegistrationResponse>("/admin/course-registrations?state=new"),
    ]);
    const courses = catalog.categories.flatMap((category) => category.specialties.flatMap((specialty) => specialty.courses));
    return {
      courses: courses.length, publishedCourses: courses.filter((course) => course.published).length,
      registrations: registrations.registrations.total,
      newRegistrations: newRegistrations.registrations.total,
      recent: registrations.registrations.data.slice(0, 5),
    };
  },
  staleTime: 30_000,
});