import { EmailVerification } from "../../components/email-verification";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const params = await searchParams;
  return <EmailVerification token={params.token ?? ""} initialEmail={params.email ?? ""} />;
}
