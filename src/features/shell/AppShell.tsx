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
        <AppSidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-1.5 border-b border-border bg-background px-2 sm:gap-3 sm:px-4">
            <SidebarTrigger className="shrink-0 text-muted-foreground" />
            <div className="hidden min-w-0 max-w-sm flex-1 md:block">
              <GlobalSearchTrigger />
            </div>
            <HeaderActions />
            <GlobalSearch />
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ProfileProvider>
  );
}