package tigers.redistricting.model;

public class Presidential2024 {
    private int dem_votes;
    private int rep_votes;
    private int total_votes;
    private double dem_pct;
    private double rep_pct;

    public int getDem_votes() { return dem_votes; }
    public void setDem_votes(int dem_votes) { this.dem_votes = dem_votes; }

    public int getRep_votes() { return rep_votes; }
    public void setRep_votes(int rep_votes) { this.rep_votes = rep_votes; }

    public int getTotal_votes() { return total_votes; }
    public void setTotal_votes(int total_votes) { this.total_votes = total_votes; }

    public double getDem_pct() { return dem_pct; }
    public void setDem_pct(double dem_pct) { this.dem_pct = dem_pct; }

    public double getRep_pct() { return rep_pct; }
    public void setRep_pct(double rep_pct) { this.rep_pct = rep_pct; }
}
