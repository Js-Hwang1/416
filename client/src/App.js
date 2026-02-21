import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/state/:stateSlug" element={<StatePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;