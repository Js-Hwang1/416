package tigers.redistricting.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.model.AnalysisData;
import tigers.redistricting.service.AnalysisService;

@RestController
@RequestMapping("/api/states/{stateId}/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @GetMapping
    public ResponseEntity<AnalysisData> getAllAnalysis(@PathVariable String stateId) {
        return analysisService.getByState(stateId.toUpperCase())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/gingles-precinct")
    public ResponseEntity<Object> getGinglesPrecinct(@PathVariable String stateId) {
        return analysisService.getGinglesPrecinct(stateId.toUpperCase())
                .map(data -> ResponseEntity.ok((Object) data))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/gingles-regression")
    public ResponseEntity<Object> getGinglesRegression(@PathVariable String stateId) {
        return analysisService.getGinglesRegression(stateId.toUpperCase())
                .map(data -> ResponseEntity.ok((Object) data))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/enacted-demographics")
    public ResponseEntity<Object> getEnactedDemographics(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEnactedDemographics);
    }

    @GetMapping("/ensemble-bar")
    public ResponseEntity<Object> getEnsembleBar(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEnsembleBar);
    }

    @GetMapping("/ensemble-box")
    public ResponseEntity<Object> getEnsembleBox(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEnsembleBox);
    }

    @GetMapping("/ei-curves")
    public ResponseEntity<Object> getEiCurves(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEiCurves);
    }

    @GetMapping("/ei-kde")
    public ResponseEntity<Object> getEiKde(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEiKde);
    }

    @GetMapping("/ei-summary")
    public ResponseEntity<Object> getEiSummary(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getEiSummary);
    }

    @GetMapping("/vote-seat")
    public ResponseEntity<Object> getVoteSeat(@PathVariable String stateId) {
        return getField(stateId, AnalysisData::getVoteSeat);
    }

    private ResponseEntity<Object> getField(String stateId,
                                             java.util.function.Function<AnalysisData, Object> extractor) {
        return analysisService.getByState(stateId.toUpperCase())
                .map(ad -> {
                    Object value = extractor.apply(ad);
                    return value != null
                            ? ResponseEntity.ok(value)
                            : ResponseEntity.notFound().<Object>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
