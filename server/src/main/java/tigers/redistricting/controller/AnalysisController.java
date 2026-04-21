package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.*;
import tigers.redistricting.service.AnalysisService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/states/{id}/analysis")
public class AnalysisController {

    private final AnalysisService analysisService;

    public AnalysisController(AnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @Cacheable("ginglesPrecinct")
    @GetMapping("/gingles-precinct")
    public ResponseEntity<Map<String, List<Map<String, Object>>>> getGinglesPrecinct(@PathVariable StateId id) {
        return analysisService.getGinglesPrecinct(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("ginglesRegression")
    @GetMapping("/gingles-regression")
    public ResponseEntity<Map<String, double[]>> getGinglesRegression(@PathVariable StateId id) {
        return analysisService.getGinglesRegression(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("enactedDemographics")
    @GetMapping("/enacted-demographics")
    public ResponseEntity<List<DistrictDemographics>> getEnactedDemographics(@PathVariable StateId id) {
        return analysisService.getEnactedDemographics(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("ensembleBar")
    @GetMapping("/ensemble-bar")
    public ResponseEntity<EnsembleBarData> getEnsembleBar(@PathVariable StateId id) {
        return analysisService.getEnsembleBar(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("ensembleBox")
    @GetMapping("/ensemble-box")
    public ResponseEntity<EnsembleBoxData> getEnsembleBox(@PathVariable StateId id) {
        return analysisService.getEnsembleBox(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("eiCurves")
    @GetMapping("/ei-curves")
    public ResponseEntity<List<EICurve>> getEiCurves(@PathVariable StateId id) {
        return analysisService.getEiCurves(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("eiKde")
    @GetMapping("/ei-kde")
    public ResponseEntity<EiKdeData> getEiKde(@PathVariable StateId id) {
        return analysisService.getEiKde(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("eiSummary")
    @GetMapping("/ei-summary")
    public ResponseEntity<List<EiSupportEntry>> getEiSummary(@PathVariable StateId id) {
        return analysisService.getEiSummary(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("voteSeat")
    @GetMapping("/vote-seat")
    public ResponseEntity<VoteSeatData> getVoteSeat(@PathVariable StateId id) {
        return analysisService.getVoteSeat(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
