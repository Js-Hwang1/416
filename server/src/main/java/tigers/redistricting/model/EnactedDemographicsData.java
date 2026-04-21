package tigers.redistricting.model;

import java.util.List;

public class EnactedDemographicsData {
    private List<DistrictDemographics> districts;

    public List<DistrictDemographics> getDistricts() { return districts; }
    public void setDistricts(List<DistrictDemographics> districts) { this.districts = districts; }
}
