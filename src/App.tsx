import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { hasOnboardedHint, useAppStore } from './store/appStore';
// La bienvenida va en el bundle inicial: es la primera pantalla de un usuario nuevo (evita un salto de red).
import { WelcomeScreen } from './features/onboarding/WelcomeScreen';
// El resto de pantallas en chunks aparte: la primera carga solo descarga lo imprescindible (LCP en móvil).
const ProfileScreen = lazy(() => import('./features/onboarding/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));
const TargetsScreen = lazy(() => import('./features/targets/TargetsScreen').then((m) => ({ default: m.TargetsScreen })));
const TodayScreen = lazy(() => import('./features/today/TodayScreen').then((m) => ({ default: m.TodayScreen })));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));
const AddFoodScreen = lazy(() => import('./features/food/AddFoodScreen').then((m) => ({ default: m.AddFoodScreen })));
const RecipesScreen = lazy(() => import('./features/recipes/RecipesScreen').then((m) => ({ default: m.RecipesScreen })));
const RecipeDetailScreen = lazy(() =>
  import('./features/recipes/RecipeDetailScreen').then((m) => ({ default: m.RecipeDetailScreen })),
);
const ProgressScreen = lazy(() => import('./features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })));
const ShopScreen = lazy(() => import('./features/shop/ShopScreen').then((m) => ({ default: m.ShopScreen })));

function RequireOnboarded({ children }: { children: ReactNode }) {
  const onboarded = useAppStore((s) => s.onboarded);
  return onboarded ? children : <Navigate to="/onboarding" replace />;
}

function TabsLayout() {
  const { t } = useTranslation();
  const tabs = [
    { to: '/today', label: t('nav.today') },
    { to: '/recipes', label: t('nav.recipes') },
    { to: '/shop', label: t('nav.shop') },
    { to: '/progress', label: t('nav.progress') },
    { to: '/settings', label: t('nav.settings') },
  ];
  return (
    <>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
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

  // Usuario nuevo (sin indicador): se pinta ya la bienvenida mientras IndexedDB carga.
  // Usuario con onboarding hecho: se espera a los datos para no enseñar la pantalla equivocada.
  if (!hydrated) {
    const path = window.location.pathname;
    if (hasOnboardedHint() || (path !== '/' && path !== '/onboarding')) return null;
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<WelcomeScreen />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
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
          <Route path="/recipes" element={<RecipesScreen />} />
          <Route path="/recipes/:id" element={<RecipeDetailScreen />} />
          <Route path="/shop" element={<ShopScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/targets" element={<TargetsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route path="*" element={<Navigate to={onboarded ? '/today' : '/onboarding'} replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
