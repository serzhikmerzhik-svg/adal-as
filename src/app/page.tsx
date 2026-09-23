import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

const ROLE_HOME: Record<string, string> = {
  KITCHEN: "/kitchen",
  NURSE: "/nurse",
  SES: "/ses",
  EDU: "/edu",
  ADMIN: "/demo",
};

export default async function Home() {
  const session = await getSession();
  redirect(session ? (ROLE_HOME[session.role] ?? "/login") : "/login");
}
