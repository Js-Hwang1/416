package tigers.redistricting.model;

import java.util.Map;

public class DistrictDemographics {
    private int district;
    private int total_vap;
    private Map<String, DemographicGroup> groups;

    public int getDistrict() { return district; }
    public void setDistrict(int district) { this.district = district; }

    public int getTotal_vap() { return total_vap; }
    public void setTotal_vap(int total_vap) { this.total_vap = total_vap; }

    public Map<String, DemographicGroup> getGroups() { return groups; }
    public void setGroups(Map<String, DemographicGroup> groups) { this.groups = groups; }
}
