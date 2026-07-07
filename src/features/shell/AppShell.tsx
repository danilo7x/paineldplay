import { useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Search } from "lucide-react";
import { Route as AuthRoute } from "@/routes/_authenticated";
import { trackSession } from "@/lib/session-tracker";
import { ProfileProvider } from "@/lib/profile-context";
import { HeaderActions } from "./HeaderActions";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = AuthRoute.useRouteContext();
  useEffect(() => {
    if (user?.id) trackSession(user.id);
  }, [user?.id]);
  return (
    <ProfileProvider userId={user.id} email={user.email ?? null}>
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-background text-foreground">
        {/* Ambient radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(5,126,243,0.22), transparent 70%)",
          }}
        />
        <AppSidebar />
        <div className="relative z-10 flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="relative hidden max-w-sm flex-1 md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Buscar…"
                className="h-8 w-full rounded-full border border-border/50 bg-card/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <HeaderActions />
          </header>
          <main className="flex-1 px-6 py-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ProfileProvider>
  );
}