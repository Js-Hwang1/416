package tigers.redistricting.service;

import org.springframework.stereotype.Service;
import tigers.redistricting.dto.StateSummary;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.State;
import tigers.redistricting.repository.StateRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class StateService {

    private final StateRepository stateRepository;

    public StateService(StateRepository stateRepository) {
        this.stateRepository = stateRepository;
    }

    public List<State> getAllStates() {
        return stateRepository.findAll();
    }

    public Optional<State> getStateById(StateId id) {
        return stateRepository.findById(id);
    }

    public Optional<StateSummary> getStateSummaryById(StateId id) {
        return stateRepository.findById(id).map(s -> new StateSummary(
            s.getId(),
            s.getState(),
            s.getState_abbr(),
            s.getTotal_population(),
            s.getVoting_age_population(),
            s.getNum_congressional_districts(),
            s.getPopulation_by_group(),
            s.getPresidential_2024(),
            s.getParty_split(),
            s.getFeasible_demographic_groups()
        ));
    }

    public Optional<Map<String, Object>> getPresidentialResults(StateId id) {
        return stateRepository.findById(id).map(State::getPresidential_2024);
    }

    public Optional<List<Map<String, Object>>> getRepresentatives(StateId id) {
        return stateRepository.findById(id).map(State::getRepresentatives);
    }

    public Optional<Map<String, Integer>> getPopulationByGroup(StateId id) {
        return stateRepository.findById(id).map(State::getPopulation_by_group);
    }

    public Optional<Map<String, Integer>> getVapByGroup(StateId id) {
        return stateRepository.findById(id).map(State::getVap_by_group);
    }

    public Optional<Map<String, Integer>> getPartySplit(StateId id) {
        return stateRepository.findById(id).map(State::getParty_split);
    }

    public Optional<List<String>> getFeasibleDemographicGroups(StateId id) {
        return stateRepository.findById(id).map(State::getFeasible_demographic_groups);
    }
}
