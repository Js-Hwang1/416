package tigers.redistricting.model;

import java.util.List;

public class EnsembleBarData {
    private List<EnsembleBarEntry> raceBlindData;
    private List<EnsembleBarEntry> vraData;

    public List<EnsembleBarEntry> getRaceBlindData() { return raceBlindData; }
    public void setRaceBlindData(List<EnsembleBarEntry> raceBlindData) { this.raceBlindData = raceBlindData; }

    public List<EnsembleBarEntry> getVraData() { return vraData; }
    public void setVraData(List<EnsembleBarEntry> vraData) { this.vraData = vraData; }
}
