import { redirect } from "next/navigation";

export default function AdminTransactionsRedirect() {
  redirect("/admin/billing/transactions");
}
