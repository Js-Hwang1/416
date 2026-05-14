package tigers.redistricting.model;

import java.util.List;
import java.util.Map;

/**
 * Per-group box-whisker series. Shape:
 *   { hispanic: { raceBlind: [...], vra: [...] }, black: {...}, asian: {...} }
 * so the UI can render side-by-side boxes for the two ensemble types (GUI-21).
 */
public class EnsembleBoxData {
    private Map<String, List<EnsembleBoxEntry>> hispanic;
    private Map<String, List<EnsembleBoxEntry>> black;
    private Map<String, List<EnsembleBoxEntry>> asian;

    public Map<String, List<EnsembleBoxEntry>> getHispanic() { return hispanic; }
    public void setHispanic(Map<String, List<EnsembleBoxEntry>> hispanic) { this.hispanic = hispanic; }

    public Map<String, List<EnsembleBoxEntry>> getBlack() { return black; }
    public void setBlack(Map<String, List<EnsembleBoxEntry>> black) { this.black = black; }

    public Map<String, List<EnsembleBoxEntry>> getAsian() { return asian; }
    public void setAsian(Map<String, List<EnsembleBoxEntry>> asian) { this.asian = asian; }
}
