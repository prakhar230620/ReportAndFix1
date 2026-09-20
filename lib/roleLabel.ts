export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "college_admin":
      return "Admin";
    case "worker":
      return "Worker";
    case "user":
      return "Member";
    default:
      return role ?? "";
  }
}
