import { Routes, Route } from "react-router-dom";
import { NotificatiesProvider } from "./context/notificaties";
import { TaalProvider } from "./context/taal";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Producten from "./pages/Producten.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Leveranciers from "./pages/Leveranciers.jsx";
import LeverancierDetail from "./pages/LeverancierDetail.jsx";
import OntbrekendeData from "./pages/OntbrekendeData.jsx";
import Wetgeving from "./pages/Wetgeving.jsx";
import Sequences from "./pages/Sequences.jsx";
import Rapportages from "./pages/Rapportages.jsx";
import Instellingen from "./pages/Instellingen.jsx";

export default function App() {
  return (
    <TaalProvider>
      <NotificatiesProvider>
        <Layout>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/producten" element={<Producten />} />
        <Route path="/producten/:id" element={<ProductDetail />} />
        <Route path="/leveranciers" element={<Leveranciers />} />
        <Route path="/leveranciers/:id" element={<LeverancierDetail />} />
        <Route path="/ontbrekende-data" element={<OntbrekendeData />} />
        <Route path="/wetgeving" element={<Wetgeving />} />
        <Route path="/sequences" element={<Sequences />} />
        <Route path="/rapportages" element={<Rapportages />} />
        <Route path="/instellingen" element={<Instellingen />} />
        </Routes>
        </Layout>
      </NotificatiesProvider>
    </TaalProvider>
  );
}
