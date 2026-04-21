package tigers.redistricting.model;

public class EiSupportCandidate {
    private String candidate;
    private int support;
    private int ci_lower;
    private int ci_upper;

    public String getCandidate() { return candidate; }
    public void setCandidate(String candidate) { this.candidate = candidate; }

    public int getSupport() { return support; }
    public void setSupport(int support) { this.support = support; }

    public int getCi_lower() { return ci_lower; }
    public void setCi_lower(int ci_lower) { this.ci_lower = ci_lower; }

    public int getCi_upper() { return ci_upper; }
    public void setCi_upper(int ci_upper) { this.ci_upper = ci_upper; }
}
