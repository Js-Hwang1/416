package tigers.redistricting.model;

import java.util.Map;

public class EiPrecinctEntry {
    private String precinct;
    private Map<String, Map<String, Double>> estimates;

    public String getPrecinct() { return precinct; }
    public void setPrecinct(String precinct) { this.precinct = precinct; }

    public Map<String, Map<String, Double>> getEstimates() { return estimates; }
    public void setEstimates(Map<String, Map<String, Double>> estimates) { this.estimates = estimates; }
}
