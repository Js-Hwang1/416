package tigers.redistricting.service;

import org.springframework.stereotype.Service;
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
}
