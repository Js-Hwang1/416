import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateSlugMatch = location.pathname.match(/^\/state\/([^/]+)$/);
  const stateNames = {
    texas: "Texas",
    massachusetts: "Massachusetts",
  };
  const headerTitle = stateSlugMatch
    ? (stateNames[stateSlugMatch[1]] || "State")
    : "Ensemble Redistricting Analysis";

  return (
    <header className="app-header">
      <span className="app-header-title" onClick={() => navigate("/")} role="button" tabIndex={0}>
        {headerTitle}
      </span>
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
