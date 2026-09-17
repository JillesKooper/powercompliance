import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/auth";
import { NotificatiesProvider } from "./context/notificaties";
import { LanguageProvider, useLanguage } from "./context/language";
import { ThemeProvider } from "./context/theme";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import UitnodigingAccepteren from "./pages/UitnodigingAccepteren.jsx";
import Gebruikers from "./pages/Gebruikers.jsx";
import Superadmin from "./pages/Superadmin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Producten from "./pages/Producten.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Leveranciers from "./pages/Leveranciers.jsx";
import LeverancierDetail from "./pages/LeverancierDetail.jsx";
import OntbrekendeData from "./pages/OntbrekendeData.jsx";
import Wetgeving from "./pages/Wetgeving.jsx";
import Sequences from "./pages/Sequences.jsx";
import Rapportages from "./pages/Rapportages.jsx";
import Activiteit from "./pages/Activiteit.jsx";
import Instellingen from "./pages/Instellingen.jsx";

// Beschermt de app: zonder geldige inlog → door naar /login. Terwijl een
// bestaand token gevalideerd wordt tonen we kort een laadmelding.
function RequireAuth({ children }) {
  const { isIngelogd, laden } = useAuth();
  const { t } = useLanguage();
  if (laden) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas text-muted text-sm">
        {t("ui.laden")}
      </div>
    );
  }
  if (!isIngelogd) return <Navigate to="/login" replace />;
  return children;
}

// Al ingelogd? Dan het inlogscherm overslaan en direct naar het dashboard.
function LoginRoute() {
  const { isIngelogd, laden } = useAuth();
  if (!laden && isIngelogd) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

// Rol-guards: sturen terug naar het dashboard als de rol onvoldoende is.
function RequireBeheerder({ children }) {
  const { isBeheerder } = useAuth();
  return isBeheerder ? children : <Navigate to="/dashboard" replace />;
}

function RequireSuperadmin({ children }) {
  const { isSuperadmin } = useAuth();
  return isSuperadmin ? children : <Navigate to="/dashboard" replace />;
}

// De volledige (beveiligde) applicatie: notificaties + layout + pagina-routes.
function BeveiligdeApp() {
  return (
    <NotificatiesProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/producten" element={<Producten />} />
          <Route path="/producten/:id" element={<ProductDetail />} />
          <Route path="/leveranciers" element={<Leveranciers />} />
          <Route path="/leveranciers/:id" element={<LeverancierDetail />} />
          <Route path="/ontbrekende-data" element={<OntbrekendeData />} />
          <Route path="/wetgeving" element={<Wetgeving />} />
          <Route path="/sequences" element={<Sequences />} />
          <Route path="/rapportages" element={<Rapportages />} />
          <Route path="/activiteit" element={<Activiteit />} />
          <Route path="/instellingen" element={<Instellingen />} />
          <Route
            path="/gebruikers"
            element={
              <RequireBeheerder>
                <Gebruikers />
              </RequireBeheerder>
            }
          />
          <Route
            path="/superadmin"
            element={
              <RequireSuperadmin>
                <Superadmin />
              </RequireSuperadmin>
            }
          />
        </Routes>
      </Layout>
    </NotificatiesProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/uitnodiging/:token"
              element={<UitnodigingAccepteren />}
            />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <BeveiligdeApp />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
