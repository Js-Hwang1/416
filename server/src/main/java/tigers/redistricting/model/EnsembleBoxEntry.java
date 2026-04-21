package tigers.redistricting.model;

public class EnsembleBoxEntry {
    private int district;
    private double min;
    private double lqr;
    private double median;
    private double hqr;
    private double max;

    public int getDistrict() { return district; }
    public void setDistrict(int district) { this.district = district; }

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
