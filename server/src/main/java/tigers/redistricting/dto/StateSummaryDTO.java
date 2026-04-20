package tigers.redistricting.dto;

import java.util.List;
import java.util.Map;

public class StateSummaryDTO {

    private String id;
    private String name;
    private String abbreviation;
    private int totalPopulation;
    private int votingAgePopulation;
    private int numCongressionalDistricts;
    private Map<String, Integer> populationByGroup;
    private Map<String, Object> presidential2024;
    private Map<String, Integer> partySplit;
    private List<String> feasibleDemographicGroups;

    public StateSummaryDTO(String id, String name, String abbreviation,
                           int totalPopulation, int votingAgePopulation,
                           int numCongressionalDistricts,
                           Map<String, Integer> populationByGroup,
                           Map<String, Object> presidential2024,
                           Map<String, Integer> partySplit,
                           List<String> feasibleDemographicGroups) {
        this.id = id;
        this.name = name;
        this.abbreviation = abbreviation;
        this.totalPopulation = totalPopulation;
        this.votingAgePopulation = votingAgePopulation;
        this.numCongressionalDistricts = numCongressionalDistricts;
        this.populationByGroup = populationByGroup;
        this.presidential2024 = presidential2024;
        this.partySplit = partySplit;
        this.feasibleDemographicGroups = feasibleDemographicGroups;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getAbbreviation() { return abbreviation; }
    public int getTotalPopulation() { return totalPopulation; }
    public int getVotingAgePopulation() { return votingAgePopulation; }
    public int getNumCongressionalDistricts() { return numCongressionalDistricts; }
    public Map<String, Integer> getPopulationByGroup() { return populationByGroup; }
    public Map<String, Object> getPresidential2024() { return presidential2024; }
    public Map<String, Integer> getPartySplit() { return partySplit; }
    public List<String> getFeasibleDemographicGroups() { return feasibleDemographicGroups; }
}
