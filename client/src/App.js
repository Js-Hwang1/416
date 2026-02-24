import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

function AppHeader() {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <span className="app-header-title" onClick={() => navigate("/")} role="button" tabIndex={0}>
        Ensemble Redistricting Analysis
      </span>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AppHeader />
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/state/:stateSlug" element={<StatePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
