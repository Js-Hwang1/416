import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

import BoxPlotChart from './box_and_whisker';
import BarChart from "./bar_chart";


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
    
    // example box and whisker
    // <div>
    //   <BoxPlotChart districts={box_data.districts} />
    // </div>
    
    // <div style={{ width: "25vw", height: "25vh" }}>
    //   <BarChart />
    // </div>
    
    
  );
}

export default App;
