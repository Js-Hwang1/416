package tigers.redistricting.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.dto.StateSummaryDTO;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.State;
import tigers.redistricting.service.StateService;

import java.util.List;

@RestController
@RequestMapping("/api/states")
public class StateController {

    private final StateService stateService;

    public StateController(StateService stateService) {
        this.stateService = stateService;
    }

    @GetMapping
    public List<State> getAllStates() {
        return stateService.getAllStates();
    }

    @GetMapping("/{id}")
    public ResponseEntity<State> getState(@PathVariable StateId id) {
        return stateService.getStateById(id.name())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<StateSummaryDTO> getStateSummary(@PathVariable StateId id) {
        return stateService.getStateSummaryById(id.name())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
