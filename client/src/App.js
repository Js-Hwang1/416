import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import logoImg from "./logo.jpeg";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import "./mapSetup";
import SplashPage from "./pages/SplashPage";
import StatePage from "./pages/StatePage";

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateSlugMatch = location.pathname.match(/^\/state\/([^/]+)$/);
  const stateNames = {
    texas: "Texas",
    massachusetts: "Massachusetts",
  };
  const headerTitle = stateSlugMatch
    ? `Ensemble Redistricting Analysis of ${stateNames[stateSlugMatch[1]] || "State"}`
    : "Ensemble Redistricting Analysis";

  return (
    <header className="app-header">
      <span className="app-header-title" onClick={() => navigate("/")} role="button" tabIndex={0}>
        {headerTitle}
      </span>
      <div className="app-header-brand">
        <span className="app-header-team">by Tigers</span>
        <img src={logoImg} alt="Tigers logo" className="app-header-logo" />
      </div>
    </header>
  );
}

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <div className="App">
        <AppHeader />
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/state/:stateSlug" element={<StatePage />} />
        </Routes>
      </div>
    </Router>
    // <GinglessScatterPlot data={dummy_scatter} />
    
  );
}

export default App;
