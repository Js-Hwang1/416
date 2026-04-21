package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import tigers.redistricting.enums.StateId;

import java.util.List;
import java.util.Map;

@Document(collection = "analysisData")
public class AnalysisData {

    @Id
    private StateId id;

    private String stateAbbr;
    private Map<String, List<PrecinctPoint>> ginglesPrecinct;
    private Map<String, List<RegressionPoint>> ginglesRegression;
    private EnactedDemographicsData enactedDemographics;
    private EnsembleBarData ensembleBar;
    private EnsembleBoxData ensembleBox;
    private List<EICurve> eiCurves;
    private EiKdeData eiKde;
    private List<EiSupportEntry> eiSummary;
    private VoteSeatData voteSeat;

    public StateId getId() { return id; }
    public void setId(StateId id) { this.id = id; }

    public String getStateAbbr() { return stateAbbr; }
    public void setStateAbbr(String stateAbbr) { this.stateAbbr = stateAbbr; }

    public Map<String, List<PrecinctPoint>> getGinglesPrecinct() { return ginglesPrecinct; }
    public void setGinglesPrecinct(Map<String, List<PrecinctPoint>> ginglesPrecinct) { this.ginglesPrecinct = ginglesPrecinct; }

    public Map<String, List<RegressionPoint>> getGinglesRegression() { return ginglesRegression; }
    public void setGinglesRegression(Map<String, List<RegressionPoint>> ginglesRegression) { this.ginglesRegression = ginglesRegression; }

    public EnactedDemographicsData getEnactedDemographics() { return enactedDemographics; }
    public void setEnactedDemographics(EnactedDemographicsData enactedDemographics) { this.enactedDemographics = enactedDemographics; }

    public EnsembleBarData getEnsembleBar() { return ensembleBar; }
    public void setEnsembleBar(EnsembleBarData ensembleBar) { this.ensembleBar = ensembleBar; }

    public EnsembleBoxData getEnsembleBox() { return ensembleBox; }
    public void setEnsembleBox(EnsembleBoxData ensembleBox) { this.ensembleBox = ensembleBox; }

    public List<EICurve> getEiCurves() { return eiCurves; }
    public void setEiCurves(List<EICurve> eiCurves) { this.eiCurves = eiCurves; }

    public EiKdeData getEiKde() { return eiKde; }
    public void setEiKde(EiKdeData eiKde) { this.eiKde = eiKde; }

    public List<EiSupportEntry> getEiSummary() { return eiSummary; }
    public void setEiSummary(List<EiSupportEntry> eiSummary) { this.eiSummary = eiSummary; }

    public VoteSeatData getVoteSeat() { return voteSeat; }
    public void setVoteSeat(VoteSeatData voteSeat) { this.voteSeat = voteSeat; }
}
