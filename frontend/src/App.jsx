import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Producten from "./pages/Producten.jsx";
import Leveranciers from "./pages/Leveranciers.jsx";
import OntbrekendeData from "./pages/OntbrekendeData.jsx";
import Wetgeving from "./pages/Wetgeving.jsx";
import Instellingen from "./pages/Instellingen.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/producten" element={<Producten />} />
        <Route path="/leveranciers" element={<Leveranciers />} />
        <Route path="/ontbrekende-data" element={<OntbrekendeData />} />
        <Route path="/wetgeving" element={<Wetgeving />} />
        <Route path="/instellingen" element={<Instellingen />} />
      </Routes>
    </Layout>
  );
}
