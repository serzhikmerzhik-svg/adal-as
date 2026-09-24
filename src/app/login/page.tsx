import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { as } = await searchParams;
  const initialLogin = typeof as === "string" ? as : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-10">
        <LoginForm key={initialLogin} initialLogin={initialLogin} />
      </main>
    </div>
  );
}
