package tigers.redistricting.model;

import java.util.List;

public class EICurve {
    private String race;
    private String candidate;
    private List<EICurvePoint> data;

    public String getRace() { return race; }
    public void setRace(String race) { this.race = race; }

    public String getCandidate() { return candidate; }
    public void setCandidate(String candidate) { this.candidate = candidate; }

    public List<EICurvePoint> getData() { return data; }
    public void setData(List<EICurvePoint> data) { this.data = data; }
}
