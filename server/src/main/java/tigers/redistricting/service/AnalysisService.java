package tigers.redistricting.service;

import org.apache.commons.math3.fitting.PolynomialCurveFitter;
import org.apache.commons.math3.fitting.WeightedObservedPoints;
import org.springframework.stereotype.Service;
import tigers.redistricting.enums.Party;
import tigers.redistricting.enums.Race;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.*;
import tigers.redistricting.repository.AnalysisDataRepository;
import tigers.redistricting.repository.StateRepository;

import java.util.*;

@Service
public class AnalysisService {

    private static final int POLY_DEGREE = 3;
    private static final double EFFECTIVENESS_THRESHOLD = 0.6;

    // EI confidence per state/group from state_config.json (minority party-of-choice vote share confidence)
    private static final Map<StateId, Map<String, Double>> EI_CONFIDENCE = Map.of(
        StateId.MA, Map.of("black", 0.97, "hispanic", 0.67, "asian", 0.98),
        StateId.TX, Map.of("black", 0.90, "hispanic", 0.58, "asian", 0.74)
    );

    private final AnalysisDataRepository analysisDataRepository;
    private final StateRepository stateRepository;

    public AnalysisService(AnalysisDataRepository analysisDataRepository, StateRepository stateRepository) {
        this.analysisDataRepository = analysisDataRepository;
        this.stateRepository = stateRepository;
    }

    /*
     * MongoDB: { hispanic: [{ precinct_id, name, total_pop, minority_pop, minority_vap_pct, d_vote_share }, ...], ... }
     * Response: { hispanic: [{ x: minority_vap_pct, y: d_vote_share }, ...], ... }
     */
    public Optional<Map<Race, List<Map<String, Object>>>> getGinglesPrecinct(StateId id) {
        return analysisDataRepository.findById(id).map(ad -> {
            Map<String, List<PrecinctPoint>> byGroup = ad.getGinglesPrecinct();
            if (byGroup == null) return null; // prevents crashing if mongo doesn't have the data

            Map<Race, List<Map<String, Object>>> result = new HashMap<>();
            for (Map.Entry<String, List<PrecinctPoint>> groupEntry : byGroup.entrySet()) {
                List<Map<String, Object>> points = new ArrayList<>();
                for (PrecinctPoint precinct : groupEntry.getValue()) {
                    points.add(Map.of("x", precinct.minority_vap_pct, "y", precinct.d_vote_share, "precinct_id", precinct.precinct_id));
                }
                result.put(Race.fromString(groupEntry.getKey()), points);
            }
            return result;
        });
    }

    /*
     * MongoDB: { hispanic: [{ x, y }, ...], ... }  (~200 sampled points along the regression curve)
     * Fits a degree-3 polynomial to those points per group
     * Response: { hispanic: [a0, a1, a2, a3], ... }  (frontend evaluates y = a0 + a1x + a2x² + a3x³)
     */
    public Optional<Map<String, double[]>> getGinglesRegression(StateId id) {
        return analysisDataRepository.findById(id).map(ad -> {
            Map<String, List<RegressionPoint>> byGroup = ad.getGinglesRegression();
            if (byGroup == null) return null;

            Map<String, double[]> result = new HashMap<>();
            for (Map.Entry<String, List<RegressionPoint>> groupEntry : byGroup.entrySet()) {
                List<RegressionPoint> rawPoints = groupEntry.getValue();
                double[] xs = new double[rawPoints.size()];
                double[] ys = new double[rawPoints.size()];
                for (int i = 0; i < rawPoints.size(); i++) {
                    xs[i] = rawPoints.get(i).x;
                    ys[i] = rawPoints.get(i).y;
                }
                result.put(groupEntry.getKey(), fitPolynomial(xs, ys));
            }
            return result;
        });
    }

    public Optional<EnactedDemographicsData> getEnactedDemographics(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEnactedDemographics);
    }

    public Optional<EnsembleBarData> getEnsembleBar(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEnsembleBar);
    }

    public Optional<EnsembleBoxData> getEnsembleBox(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEnsembleBox);
    }

    public Optional<List<EICurve>> getEiCurves(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEiCurves);
    }

    public Optional<EiKdeData> getEiKde(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEiKde);
    }

    public Optional<List<EiSupportEntry>> getEiSummary(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEiSummary);
    }

    public Optional<List<EiPrecinctEntry>> getEiPrecinct(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEiPrecinct);
    }

    public Optional<VoteSeatData> getVoteSeat(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getVoteSeat);
    }

    public Optional<MinorityEffectivenessData> getMinorityEffectiveness(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getMinorityEffectiveness);
    }

    public Optional<List<RoughProportionalityEntry>> getRoughProportionality(StateId id) {
        Optional<State> stateOpt = stateRepository.findById(id);
        Optional<AnalysisData> analysisOpt = analysisDataRepository.findById(id);
        if (stateOpt.isEmpty() || analysisOpt.isEmpty()) return Optional.empty();

        State state = stateOpt.get();
        AnalysisData analysis = analysisOpt.get();

        Map<String, Integer> vapByGroup = state.getVap_by_group();
        int totalVap = state.getVoting_age_population();
        int totalDistricts = state.getNum_congressional_districts();
        List<String> feasibleGroups = state.getFeasible_demographic_groups();

        // Read the enacted-plan effective counts produced by the SeaWulf
        // pipeline (stored under minorityBarsByThreshold."0.6".<Group>.effective.enacted),
        // not the simplified Java formula. This makes the table consistent
        // with the seat-split / minority bars charts on the same page.
        Map<String, Map<String, Map<String, Map<String, Object>>>> mbt = analysis.getMinorityBarsByThreshold();
        String thresholdKey = String.format("%.1f", EFFECTIVENESS_THRESHOLD);
        Map<String, Map<String, Map<String, Object>>> atThreshold = mbt == null ? null : mbt.get(thresholdKey);

        List<RoughProportionalityEntry> result = new ArrayList<>();

        // Iterate the configured groups (sorted for deterministic output)
        List<String> groups = new ArrayList<>(EI_CONFIDENCE.getOrDefault(id, Map.of()).keySet());
        groups.sort(Comparator.naturalOrder());

        for (String group : groups) {
            if ("white".equals(group)) continue;
            if (feasibleGroups != null && !feasibleGroups.contains(group)) continue;

            int effectiveCount = lookupEnactedEffective(atThreshold, group);
            double effectivePct = totalDistricts > 0 ? (effectiveCount * 100.0) / totalDistricts : 0;
            int groupVap = vapByGroup != null ? vapByGroup.getOrDefault(group, 0) : 0;
            double vapPct = totalVap > 0 ? (groupVap * 100.0) / totalVap : 0;
            double ratio = vapPct > 0 ? effectivePct / vapPct : 0;

            RoughProportionalityEntry entry = new RoughProportionalityEntry();
            entry.setGroup(group);
            entry.setEffectiveDistrictCount(effectiveCount);
            entry.setEffectiveDistrictPct(Math.round(effectivePct * 10.0) / 10.0);
            entry.setVapPct(Math.round(vapPct * 10.0) / 10.0);
            entry.setRatio(Math.round(ratio * 100.0) / 100.0);
            result.add(entry);
        }

        return Optional.of(result);
    }

    /** mbt structure: { "Black": { "effective": { "enacted": N, ... }, ... }, ... }.
     *  Group keys in mongo are capitalized; our internal `group` is lowercase. */
    private int lookupEnactedEffective(Map<String, Map<String, Map<String, Object>>> atThreshold, String group) {
        if (atThreshold == null) return 0;
        String capKey = group.substring(0, 1).toUpperCase() + group.substring(1);
        Map<String, Map<String, Object>> perGroup = atThreshold.get(capKey);
        if (perGroup == null) return 0;
        Map<String, Object> effective = perGroup.get("effective");
        if (effective == null) return 0;
        Object enacted = effective.get("enacted");
        if (enacted instanceof Number) return ((Number) enacted).intValue();
        return 0;
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints points = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) points.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(points.toList());
    }

    // --------------- Variant-aware aggregates ---------------

    private static final String DEFAULT_VARIANT = "robust";

    /** Normalizes a path-segment threshold to the "0.5" / "0.6" / "0.7" key
     *  used in the Mongo document. Accepts "0.5", "t05", "t5", etc. */
    private static String normalizeThreshold(String raw) {
        if (raw == null) return null;
        String s = raw.toLowerCase().trim();
        if (s.startsWith("t")) s = s.substring(1);
        try {
            double d = Double.parseDouble(s);
            if (d > 1.0) d = d / 10.0;   // "5" / "05" -> 0.5
            return String.format(java.util.Locale.US, "%.1f", d);
        } catch (NumberFormatException ex) {
            return raw;
        }
    }

    private Optional<Object> getVariantSlice(StateId id, String threshold, String variant,
                                             java.util.function.Function<AnalysisData, Map<String, Map<String, Object>>> picker) {
        return analysisDataRepository.findById(id).map(ad -> {
            Map<String, Map<String, Object>> byVariant = picker.apply(ad);
            if (byVariant == null) return null;
            String v = (variant == null || variant.isEmpty()) ? DEFAULT_VARIANT : variant;
            Map<String, Object> byThreshold = byVariant.get(v);
            if (byThreshold == null) return null;
            String t = normalizeThreshold(threshold);
            Object slice = byThreshold.get(t);
            return slice;
        });
    }

    public Optional<Object> getEnsembleBarVariant(StateId id, String threshold, String variant) {
        return getVariantSlice(id, threshold, variant, AnalysisData::getEnsembleBarsByVariant);
    }

    public Optional<Object> getMinorityBarsVariant(StateId id, String threshold, String variant) {
        return getVariantSlice(id, threshold, variant, AnalysisData::getMinorityBarsByVariant);
    }

    public Optional<Object> getVraImpactVariant(StateId id, String threshold, String variant) {
        return getVariantSlice(id, threshold, variant, AnalysisData::getVraImpactByVariant);
    }

    public Optional<Map<String, Object>> getExpectedSeatChange(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getExpectedSeatChange);
    }

    public Optional<Map<String, Object>> getEnactedDistrictEi(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getEnactedDistrictEi);
    }
}
