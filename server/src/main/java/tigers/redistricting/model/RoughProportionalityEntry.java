package tigers.redistricting.model;

public class RoughProportionalityEntry {
    private String group;
    private int effectiveDistrictCount;
    private double effectiveDistrictPct;
    private double vapPct;
    private double ratio;

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public int getEffectiveDistrictCount() { return effectiveDistrictCount; }
    public void setEffectiveDistrictCount(int effectiveDistrictCount) { this.effectiveDistrictCount = effectiveDistrictCount; }

    public double getEffectiveDistrictPct() { return effectiveDistrictPct; }
    public void setEffectiveDistrictPct(double effectiveDistrictPct) { this.effectiveDistrictPct = effectiveDistrictPct; }

    public double getVapPct() { return vapPct; }
    public void setVapPct(double vapPct) { this.vapPct = vapPct; }

    public double getRatio() { return ratio; }
    public void setRatio(double ratio) { this.ratio = ratio; }
}
