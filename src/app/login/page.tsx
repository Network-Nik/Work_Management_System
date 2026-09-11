import { AuthForm } from "@/app/auth/auth-form";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const notice =
    error === "confirmation"
      ? "We couldn't confirm your email. Please request a new confirmation link."
      : undefined;

  return <AuthForm mode="sign-in" notice={notice} />;
}
