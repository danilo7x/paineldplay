import { useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Route as AuthRoute } from "@/routes/_authenticated";
import { trackSession } from "@/lib/session-tracker";
import { ProfileProvider } from "@/lib/profile-context";
import { HeaderActions } from "./HeaderActions";
import { GlobalSearch, GlobalSearchTrigger } from "./GlobalSearch";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = AuthRoute.useRouteContext();
  useEffect(() => {
    if (user?.id) trackSession(user.id);
  }, [user?.id]);
  return (
    <ProfileProvider userId={user.id} email={user.email ?? null}>
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background text-foreground">
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
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-1.5 border-b border-border/40 bg-background/60 px-2 backdrop-blur-xl sm:gap-3 sm:px-4">
            <SidebarTrigger className="shrink-0" />
            <div className="hidden min-w-0 max-w-sm flex-1 md:block">
              <GlobalSearchTrigger />
            </div>
            <HeaderActions />
            <GlobalSearch />
          </header>
          <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-8">
            <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ProfileProvider>
  );
}