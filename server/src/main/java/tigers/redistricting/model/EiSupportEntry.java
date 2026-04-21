package tigers.redistricting.model;

import tigers.redistricting.enums.Race;
import java.util.List;

public class EiSupportEntry {
    private Race group;
    private List<EiSupportCandidate> candidates;

    public Race getGroup() { return group; }
    public void setGroup(Race group) { this.group = group; }

    public List<EiSupportCandidate> getCandidates() { return candidates; }
    public void setCandidates(List<EiSupportCandidate> candidates) { this.candidates = candidates; }
}
