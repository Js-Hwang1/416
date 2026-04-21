package tigers.redistricting.model;

import tigers.redistricting.enums.Race;

public class MinorityEffectivenessEntry {
    private Race group;
    private double min;
    private double lqr;
    private double median;
    private double hqr;
    private double max;

    public Race getGroup() { return group; }
    public void setGroup(Race group) { this.group = group; }

    public double getMin() { return min; }
    public void setMin(double min) { this.min = min; }

    public double getLqr() { return lqr; }
    public void setLqr(double lqr) { this.lqr = lqr; }

    public double getMedian() { return median; }
    public void setMedian(double median) { this.median = median; }

    public double getHqr() { return hqr; }
    public void setHqr(double hqr) { this.hqr = hqr; }

    public double getMax() { return max; }
    public void setMax(double max) { this.max = max; }
}
