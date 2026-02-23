import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="app-header">
      <div className="app-header-left">
        <span className="app-header-logo" onClick={() => navigate("/")} role="button" tabIndex={0}>
          Redistricting Analysis
        </span>
      </div>
      <div className="app-header-right">
        {!isHome && (
          <button className="app-header-home-btn" onClick={() => navigate("/")}>
            Home
          </button>
        )}
      </div>
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
