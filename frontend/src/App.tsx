import { Routes, Route } from "react-router-dom";
import { Container } from "@mui/material";
import Dashboard from "./pages/Dashboard";
import SimulationPage from "./pages/SimulationPage";
import TrainingPage from "./pages/TrainingPage";
import ScenarioEditor from "./pages/ScenarioEditor";
import Layout from "./components/Layout";
import "./App.css";

function App() {
  return (
    <Container maxWidth={false} disableGutters>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="scenarios" element={<ScenarioEditor />} />
          <Route path="scenarios/:id" element={<ScenarioEditor />} />
        </Route>
      </Routes>
    </Container>
  );
}

export default App;
