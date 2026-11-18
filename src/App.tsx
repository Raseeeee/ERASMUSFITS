import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { useAppStore } from './store/appStore';
import { WelcomeScreen } from './features/onboarding/WelcomeScreen';
import { ProfileScreen } from './features/onboarding/ProfileScreen';
import { TargetsScreen } from './features/targets/TargetsScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { AddFoodScreen } from './features/food/AddFoodScreen';

function RequireOnboarded({ children }: { children: ReactNode }) {
  const onboarded = useAppStore((s) => s.onboarded);
  return onboarded ? children : <Navigate to="/onboarding" replace />;
}

function TabsLayout() {
  const { t } = useTranslation();
  const tabs = [
    { to: '/today', label: t('nav.today') },
    { to: '/targets', label: t('nav.targets') },
    { to: '/settings', label: t('nav.settings') },
  ];
  return (
    <>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 border-t border-bd bg-card pb-[env(safe-area-inset-bottom)]" aria-label="main">
        <ul className="mx-auto flex max-w-xl">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex min-h-14 items-center justify-center text-sm ${isActive ? 'font-semibold text-ac' : 'text-mu'}`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export default function App() {
  const { hydrated, hydrate, language, onboarded } = useAppStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (language && i18n.language !== language) void i18n.changeLanguage(language);
  }, [language, i18n]);

  if (!hydrated) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<WelcomeScreen />} />
        <Route path="/onboarding/profile" element={<ProfileScreen />} />
        <Route path="/onboarding/targets" element={<TargetsScreen onboarding />} />
        <Route
          element={
            <RequireOnboarded>
              <TabsLayout />
            </RequireOnboarded>
          }
        >
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/add" element={<AddFoodScreen />} />
          <Route path="/targets" element={<TargetsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="*" element={<Navigate to={onboarded ? '/today' : '/onboarding'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
