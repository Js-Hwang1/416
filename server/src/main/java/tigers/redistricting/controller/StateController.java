package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.dto.StateSummary;
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

    @Cacheable("allStates")
    @GetMapping
    public List<State> getAllStates() {
        return stateService.getAllStates();
    }

    @Cacheable("stateById")
    @GetMapping("/{id}")
    public ResponseEntity<State> getState(@PathVariable StateId id) {
        return stateService.getStateById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("stateSummary")
    @GetMapping("/{id}/summary")
    public ResponseEntity<StateSummary> getStateSummary(@PathVariable StateId id) {
        return stateService.getStateSummaryById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
