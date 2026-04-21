package tigers.redistricting.model;

import tigers.redistricting.enums.Race;

import java.util.List;

public class EICurve {
    private Race race;
    private String candidate;
    private List<EICurvePoint> data;

    public Race getRace() { return race; }
    public void setRace(Race race) { this.race = race; }

    public String getCandidate() { return candidate; }
    public void setCandidate(String candidate) { this.candidate = candidate; }

    public List<EICurvePoint> getData() { return data; }
    public void setData(List<EICurvePoint> data) { this.data = data; }
}
