package tigers.redistricting.model;

import java.util.List;

public class EnsembleBoxData {
    private List<EnsembleBoxEntry> hispanic;
    private List<EnsembleBoxEntry> black;
    private List<EnsembleBoxEntry> asian;

    public List<EnsembleBoxEntry> getHispanic() { return hispanic; }
    public void setHispanic(List<EnsembleBoxEntry> hispanic) { this.hispanic = hispanic; }

    public List<EnsembleBoxEntry> getBlack() { return black; }
    public void setBlack(List<EnsembleBoxEntry> black) { this.black = black; }

    public List<EnsembleBoxEntry> getAsian() { return asian; }
    public void setAsian(List<EnsembleBoxEntry> asian) { this.asian = asian; }
}
