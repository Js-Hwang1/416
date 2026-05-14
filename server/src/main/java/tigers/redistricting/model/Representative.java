package tigers.redistricting.model;

import tigers.redistricting.enums.Party;

public class Representative {
    private int district;
    private String name;
    private Party party;
    private String race_ethnicity;
    private Double vote_margin_pct;

    public int getDistrict() { return district; }
    public void setDistrict(int district) { this.district = district; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Party getParty() { return party; }
    public void setParty(Party party) { this.party = party; }

    public String getRace_ethnicity() { return race_ethnicity; }
    public void setRace_ethnicity(String race_ethnicity) { this.race_ethnicity = race_ethnicity; }

    public Double getVote_margin_pct() { return vote_margin_pct; }
    public void setVote_margin_pct(Double vote_margin_pct) { this.vote_margin_pct = vote_margin_pct; }
}
