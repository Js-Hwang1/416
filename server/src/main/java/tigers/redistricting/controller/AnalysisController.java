package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.Race;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.*;
import tigers.redistricting.service.AnalysisService;

import java.util.List;

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
    public ResponseEntity<Map<Race, List<Map<String, Object>>>> getGinglesPrecinct(@PathVariable StateId id) {
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
    public ResponseEntity<EnactedDemographicsData> getEnactedDemographics(@PathVariable StateId id) {
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

    @Cacheable("eiPrecinct")
    @GetMapping("/ei-precinct")
    public ResponseEntity<List<EiPrecinctEntry>> getEiPrecinct(@PathVariable StateId id) {
        return analysisService.getEiPrecinct(id)
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

    @Cacheable("minorityEffectiveness")
    @GetMapping("/minority-effectiveness")
    public ResponseEntity<MinorityEffectivenessData> getMinorityEffectiveness(@PathVariable StateId id) {
        return analysisService.getMinorityEffectiveness(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("roughProportionality")
    @GetMapping("/rough-proportionality")
    public ResponseEntity<List<RoughProportionalityEntry>> getRoughProportionality(@PathVariable StateId id) {
        return analysisService.getRoughProportionality(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ---- Variant-aware aggregates ----
    // Threshold values are passed as path segments using either decimal form
    // ("0.5") or the legacy short form ("t05"). Both are accepted.
    @Cacheable(value = "ensembleBarVariant", key = "#id.toString()+#threshold+#variant")
    @GetMapping({ "/ensemble-bar/{threshold}/{variant}", "/ensemble-bar/{threshold}" })
    public ResponseEntity<Object> getEnsembleBarVariant(
            @PathVariable StateId id,
            @PathVariable String threshold,
            @PathVariable(required = false) String variant) {
        return analysisService.getEnsembleBarVariant(id, threshold, variant)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Cacheable(value = "minorityBarsVariant", key = "#id.toString()+#threshold+#variant")
    @GetMapping({ "/minority-bars/{threshold}/{variant}", "/minority-bars/{threshold}" })
    public ResponseEntity<Object> getMinorityBarsVariant(
            @PathVariable StateId id,
            @PathVariable String threshold,
            @PathVariable(required = false) String variant) {
        return analysisService.getMinorityBarsVariant(id, threshold, variant)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Cacheable(value = "vraImpactVariant", key = "#id.toString()+#threshold+#variant")
    @GetMapping({ "/vra-impact/{threshold}/{variant}", "/vra-impact/{threshold}" })
    public ResponseEntity<Object> getVraImpactVariant(
            @PathVariable StateId id,
            @PathVariable String threshold,
            @PathVariable(required = false) String variant) {
        return analysisService.getVraImpactVariant(id, threshold, variant)
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Cacheable("expectedSeatChange")
    @GetMapping("/expected-seat-change")
    public ResponseEntity<Map<String, Object>> getExpectedSeatChange(@PathVariable StateId id) {
        return analysisService.getExpectedSeatChange(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("enactedDistrictEi")
    @GetMapping("/enacted-district-ei")
    public ResponseEntity<Map<String, Object>> getEnactedDistrictEi(@PathVariable StateId id) {
        return analysisService.getEnactedDistrictEi(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("interestingPlans")
    @GetMapping("/interesting-plans")
    public ResponseEntity<List<Map<String, Object>>> getInterestingPlans(@PathVariable StateId id) {
        return analysisService.getInterestingPlans(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
