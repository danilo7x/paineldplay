import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/LoginPage";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — DPlay Solutions" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
// touch
