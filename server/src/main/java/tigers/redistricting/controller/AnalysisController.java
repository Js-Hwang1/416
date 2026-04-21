package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.AnalysisData;
import tigers.redistricting.service.AnalysisService;

@RestController
@RequestMapping("/api/states/{id}/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @GetMapping
    public ResponseEntity<AnalysisData> getAllAnalysis(@PathVariable StateId id) {
        return analysisService.getByState(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("ginglesPrecinct")
    @GetMapping("/gingles-precinct")
    public ResponseEntity<Object> getGinglesPrecinct(@PathVariable StateId id) {
        return analysisService.getGinglesPrecinct(id)
                .map(data -> ResponseEntity.ok((Object) data))
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("ginglesRegression")
    @GetMapping("/gingles-regression")
    public ResponseEntity<Object> getGinglesRegression(@PathVariable StateId id) {
        return analysisService.getGinglesRegression(id)
                .map(data -> ResponseEntity.ok((Object) data))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/enacted-demographics")
    public ResponseEntity<Object> getEnactedDemographics(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEnactedDemographics);
    }

    @GetMapping("/ensemble-bar")
    public ResponseEntity<Object> getEnsembleBar(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEnsembleBar);
    }

    @GetMapping("/ensemble-box")
    public ResponseEntity<Object> getEnsembleBox(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEnsembleBox);
    }

    @GetMapping("/ei-curves")
    public ResponseEntity<Object> getEiCurves(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEiCurves);
    }

    @GetMapping("/ei-kde")
    public ResponseEntity<Object> getEiKde(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEiKde);
    }

    @GetMapping("/ei-summary")
    public ResponseEntity<Object> getEiSummary(@PathVariable StateId id) {
        return getField(id, AnalysisData::getEiSummary);
    }

    @GetMapping("/vote-seat")
    public ResponseEntity<Object> getVoteSeat(@PathVariable StateId id) {
        return getField(id, AnalysisData::getVoteSeat);
    }

    private ResponseEntity<Object> getField(StateId id,
                                             java.util.function.Function<AnalysisData, Object> extractor) {
        return analysisService.getByState(id)
                .map(ad -> {
                    Object value = extractor.apply(ad);
                    return value != null
                            ? ResponseEntity.ok(value)
                            : ResponseEntity.notFound().<Object>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
