package tigers.redistricting.model;

import tigers.redistricting.enums.Party;

public class Representative {
    private int district;
    private String name;
    private Party party;

    public int getDistrict() { return district; }
    public void setDistrict(int district) { this.district = district; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Party getParty() { return party; }
    public void setParty(Party party) { this.party = party; }
}
