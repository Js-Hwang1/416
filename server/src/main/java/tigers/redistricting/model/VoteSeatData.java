package tigers.redistricting.model;

import java.util.List;

public class VoteSeatData {
    private List<VoteSeatPoint> curve;
    private VoteSeatPoint enacted;

    public List<VoteSeatPoint> getCurve() { return curve; }
    public void setCurve(List<VoteSeatPoint> curve) { this.curve = curve; }

    public VoteSeatPoint getEnacted() { return enacted; }
    public void setEnacted(VoteSeatPoint enacted) { this.enacted = enacted; }
}
