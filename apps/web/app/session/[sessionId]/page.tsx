import { redirect } from "next/navigation";

export default function SessionRootPage({ params }: Readonly<{ params: { sessionId: string } }>) {
  redirect(`/session/${params.sessionId}/menu`);
}
