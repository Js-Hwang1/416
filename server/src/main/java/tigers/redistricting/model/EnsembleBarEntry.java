package tigers.redistricting.model;

public class EnsembleBarEntry {
    private int republican;
    private int democrat;
    private int freq;

    public int getRepublican() { return republican; }
    public void setRepublican(int republican) { this.republican = republican; }

    public int getDemocrat() { return democrat; }
    public void setDemocrat(int democrat) { this.democrat = democrat; }

    public int getFreq() { return freq; }
    public void setFreq(int freq) { this.freq = freq; }
}
