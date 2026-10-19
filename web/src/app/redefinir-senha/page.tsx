import { PasswordReset } from "../../components/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  return <PasswordReset token={params.token ?? ""} initialEmail={params.email ?? ""} />;
}
