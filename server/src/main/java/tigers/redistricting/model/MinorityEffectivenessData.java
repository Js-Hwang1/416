package tigers.redistricting.model;

import java.util.List;

public class MinorityEffectivenessData {
    private List<MinorityEffectivenessEntry> raceBlind;
    private List<MinorityEffectivenessEntry> vra;

    public List<MinorityEffectivenessEntry> getRaceBlind() { return raceBlind; }
    public void setRaceBlind(List<MinorityEffectivenessEntry> raceBlind) { this.raceBlind = raceBlind; }

    public List<MinorityEffectivenessEntry> getVra() { return vra; }
    public void setVra(List<MinorityEffectivenessEntry> vra) { this.vra = vra; }
}
