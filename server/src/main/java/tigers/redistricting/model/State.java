package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

@Document(collection = "states")
public class State {

    @Id
    private String id;

    private String state;
    private String state_abbr;
    private int total_population;
    private int voting_age_population;
    private Map<String, Integer> population_by_group;
    private Map<String, Integer> vap_by_group;
    private Map<String, Object> presidential_2024;
    private int num_congressional_districts;
    private Map<String, Integer> party_split;
    private List<String> feasible_demographic_groups;
    private List<Map<String, Object>> representatives;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getState_abbr() { return state_abbr; }
    public void setState_abbr(String state_abbr) { this.state_abbr = state_abbr; }

    public int getTotal_population() { return total_population; }
    public void setTotal_population(int total_population) { this.total_population = total_population; }

    public int getVoting_age_population() { return voting_age_population; }
    public void setVoting_age_population(int voting_age_population) { this.voting_age_population = voting_age_population; }

    public Map<String, Integer> getPopulation_by_group() { return population_by_group; }
    public void setPopulation_by_group(Map<String, Integer> population_by_group) { this.population_by_group = population_by_group; }

    public Map<String, Integer> getVap_by_group() { return vap_by_group; }
    public void setVap_by_group(Map<String, Integer> vap_by_group) { this.vap_by_group = vap_by_group; }

    public Map<String, Object> getPresidential_2024() { return presidential_2024; }
    public void setPresidential_2024(Map<String, Object> presidential_2024) { this.presidential_2024 = presidential_2024; }

    public int getNum_congressional_districts() { return num_congressional_districts; }
    public void setNum_congressional_districts(int num_congressional_districts) { this.num_congressional_districts = num_congressional_districts; }

    public Map<String, Integer> getParty_split() { return party_split; }
    public void setParty_split(Map<String, Integer> party_split) { this.party_split = party_split; }

    public List<String> getFeasible_demographic_groups() { return feasible_demographic_groups; }
    public void setFeasible_demographic_groups(List<String> feasible_demographic_groups) { this.feasible_demographic_groups = feasible_demographic_groups; }

    public List<Map<String, Object>> getRepresentatives() { return representatives; }
    public void setRepresentatives(List<Map<String, Object>> representatives) { this.representatives = representatives; }
}
