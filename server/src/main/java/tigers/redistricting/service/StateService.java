package tigers.redistricting.service;

import org.springframework.stereotype.Service;
import tigers.redistricting.enums.Party;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.Presidential2024;
import tigers.redistricting.model.Representative;
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

    public Optional<State> getStateById(StateId id) {
        return stateRepository.findById(id);
    }

    public Optional<Presidential2024> getPresidentialResults(StateId id) {
        return stateRepository.findById(id).map(State::getPresidential_2024);
    }

    public Optional<List<Representative>> getRepresentatives(StateId id) {
        return stateRepository.findById(id).map(State::getRepresentatives);
    }

    public Optional<Map<String, Integer>> getPopulationByGroup(StateId id) {
        return stateRepository.findById(id).map(State::getPopulation_by_group);
    }

    public Optional<Map<String, Integer>> getVapByGroup(StateId id) {
        return stateRepository.findById(id).map(State::getVap_by_group);
    }

    public Optional<Map<Party, Integer>> getPartySplit(StateId id) {
        return stateRepository.findById(id).map(State::getParty_split);
    }

    public Optional<List<String>> getFeasibleDemographicGroups(StateId id) {
        return stateRepository.findById(id).map(State::getFeasible_demographic_groups);
    }
}
