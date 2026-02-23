/// <reference types="vite/client" />
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { useAuth } from '~/hooks/useAuth';
import { Layout } from '~/components/Layout';
import { Login } from '~/components/Login';
import { WireGuardSetup } from '~/components/WireGuardSetup';
import { api, type WireGuardCheck } from '~/lib/api';
import appCss from '~/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Yantraform' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🛡️</text></svg>' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <AppShell />
    </RootDocument>
  );
}

function AppShell() {
  const { authenticated, loading: authLoading, login, logout } = useAuth();
  const [wgCheck, setWgCheck] = useState<WireGuardCheck | null>(null);
  const [wgLoading, setWgLoading] = useState(true);

  const checkWireGuard = useCallback(async () => {
    setWgLoading(true);
    try {
      const result = await api.server.check();
      setWgCheck(result);
    } catch {
      // If the check endpoint fails, assume not installed
      setWgCheck({ wgInstalled: false, wgToolsInstalled: false, wgVersion: null });
    } finally {
      setWgLoading(false);
    }
  }, []);

  useEffect(() => {
    checkWireGuard();
  }, [checkWireGuard]);

  if (wgLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (wgCheck && (!wgCheck.wgInstalled || !wgCheck.wgToolsInstalled || !wgCheck.sudoAccess)) {
    return <WireGuardSetup check={wgCheck} onRetry={checkWireGuard} />;
  }

  if (!authenticated) {
    return <Login onLogin={login} />;
  }

  return (
    <Layout onLogout={logout}>
      <Outlet />
    </Layout>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
