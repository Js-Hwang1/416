import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import SplashPage from "./SplashPage";
import StatePage from "./StatePage";

import BoxPlotChart from './box_and_whisker';
import box_data from './dummy_data/dummy_box_and_whisker.json';


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
  );
}

export default App;
