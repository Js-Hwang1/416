package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import tigers.redistricting.enums.StateId;

import java.util.List;
import java.util.Map;
import tigers.redistricting.model.PrecinctPoint;
import tigers.redistricting.model.RegressionPoint;

@Document(collection = "analysisData")
public class AnalysisData {

    @Id
    private StateId id;

    private String stateAbbr;
    private Map<String, List<PrecinctPoint>> ginglesPrecinct;
    private Map<String, List<RegressionPoint>> ginglesRegression;
    private Object enactedDemographics;
    private Object ensembleBar;
    private Object ensembleBox;
    private List<EICurve> eiCurves;
    private Object eiKde;
    private Object eiSummary;
    private Object voteSeat;

    public StateId getId() { return id; }
    public void setId(StateId id) { this.id = id; }

    public String getStateAbbr() { return stateAbbr; }
    public void setStateAbbr(String stateAbbr) { this.stateAbbr = stateAbbr; }

    public Map<String, List<PrecinctPoint>> getGinglesPrecinct() { return ginglesPrecinct; }
    public void setGinglesPrecinct(Map<String, List<PrecinctPoint>> ginglesPrecinct) { this.ginglesPrecinct = ginglesPrecinct; }

    public Map<String, List<RegressionPoint>> getGinglesRegression() { return ginglesRegression; }
    public void setGinglesRegression(Map<String, List<RegressionPoint>> ginglesRegression) { this.ginglesRegression = ginglesRegression; }

    public Object getEnactedDemographics() { return enactedDemographics; }
    public void setEnactedDemographics(Object enactedDemographics) { this.enactedDemographics = enactedDemographics; }

    public Object getEnsembleBar() { return ensembleBar; }
    public void setEnsembleBar(Object ensembleBar) { this.ensembleBar = ensembleBar; }

    public Object getEnsembleBox() { return ensembleBox; }
    public void setEnsembleBox(Object ensembleBox) { this.ensembleBox = ensembleBox; }

    public List<EICurve> getEiCurves() { return eiCurves; }
    public void setEiCurves(List<EICurve> eiCurves) { this.eiCurves = eiCurves; }

    public Object getEiKde() { return eiKde; }
    public void setEiKde(Object eiKde) { this.eiKde = eiKde; }

    public Object getEiSummary() { return eiSummary; }
    public void setEiSummary(Object eiSummary) { this.eiSummary = eiSummary; }

    public Object getVoteSeat() { return voteSeat; }
    public void setVoteSeat(Object voteSeat) { this.voteSeat = voteSeat; }
}
