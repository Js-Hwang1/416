package tigers.redistricting.service;

import org.springframework.stereotype.Service;
import tigers.redistricting.dto.StateSummaryDTO;
import tigers.redistricting.model.State;
import tigers.redistricting.repository.StateRepository;

import java.util.List;
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

    public Optional<State> getStateById(String id) {
        return stateRepository.findById(id);
    }

    public Optional<StateSummaryDTO> getStateSummaryById(String id) {
        return stateRepository.findById(id).map(s -> new StateSummaryDTO(
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
}
