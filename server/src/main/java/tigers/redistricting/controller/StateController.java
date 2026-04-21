package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.Party;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.Presidential2024;
import tigers.redistricting.model.Representative;
import tigers.redistricting.model.State;
import tigers.redistricting.service.StateService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/states")
public class StateController {

    private final StateService stateService;

    public StateController(StateService stateService) {
        this.stateService = stateService;
    }

    @Cacheable("stateById")
    @GetMapping("/{id}")
    public ResponseEntity<State> getStateSummary(@PathVariable StateId id) {
        return stateService.getStateById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("presidentialResults")
    @GetMapping("/{id}/presidential-results")
    public ResponseEntity<Presidential2024> getPresidentialResults(@PathVariable StateId id) {
        return stateService.getPresidentialResults(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("representatives")
    @GetMapping("/{id}/representatives")
    public ResponseEntity<List<Representative>> getRepresentatives(@PathVariable StateId id) {
        return stateService.getRepresentatives(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("populationByGroup")
    @GetMapping("/{id}/population-by-group")
    public ResponseEntity<Map<String, Integer>> getPopulationByGroup(@PathVariable StateId id) {
        return stateService.getPopulationByGroup(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("vapByGroup")
    @GetMapping("/{id}/vap-by-group")
    public ResponseEntity<Map<String, Integer>> getVapByGroup(@PathVariable StateId id) {
        return stateService.getVapByGroup(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("partySplit")
    @GetMapping("/{id}/party-split")
    public ResponseEntity<Map<Party, Integer>> getPartySplit(@PathVariable StateId id) {
        return stateService.getPartySplit(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("feasibleDemographicGroups")
    @GetMapping("/{id}/feasible-demographic-groups")
    public ResponseEntity<List<String>> getFeasibleDemographicGroups(@PathVariable StateId id) {
        return stateService.getFeasibleDemographicGroups(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
