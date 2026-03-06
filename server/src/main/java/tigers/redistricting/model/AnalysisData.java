package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "analysisData")
public class AnalysisData {

    @Id
    private String id;

    private String stateAbbr;
    private Object ginglesPrecinct;
    private Object ginglesRegression;
    private Object enactedDemographics;
    private Object ensembleBar;
    private Object ensembleBox;
    private Object eiCurves;
    private Object eiKde;
    private Object eiSummary;
    private Object voteSeat;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStateAbbr() { return stateAbbr; }
    public void setStateAbbr(String stateAbbr) { this.stateAbbr = stateAbbr; }

    public Object getGinglesPrecinct() { return ginglesPrecinct; }
    public void setGinglesPrecinct(Object ginglesPrecinct) { this.ginglesPrecinct = ginglesPrecinct; }

    public Object getGinglesRegression() { return ginglesRegression; }
    public void setGinglesRegression(Object ginglesRegression) { this.ginglesRegression = ginglesRegression; }

    public Object getEnactedDemographics() { return enactedDemographics; }
    public void setEnactedDemographics(Object enactedDemographics) { this.enactedDemographics = enactedDemographics; }

    public Object getEnsembleBar() { return ensembleBar; }
    public void setEnsembleBar(Object ensembleBar) { this.ensembleBar = ensembleBar; }

    public Object getEnsembleBox() { return ensembleBox; }
    public void setEnsembleBox(Object ensembleBox) { this.ensembleBox = ensembleBox; }

    public Object getEiCurves() { return eiCurves; }
    public void setEiCurves(Object eiCurves) { this.eiCurves = eiCurves; }

    public Object getEiKde() { return eiKde; }
    public void setEiKde(Object eiKde) { this.eiKde = eiKde; }

    public Object getEiSummary() { return eiSummary; }
    public void setEiSummary(Object eiSummary) { this.eiSummary = eiSummary; }

    public Object getVoteSeat() { return voteSeat; }
    public void setVoteSeat(Object voteSeat) { this.voteSeat = voteSeat; }
}
