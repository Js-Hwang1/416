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
                    points.add(Map.of("x", precinct.minority_vap_pct, "y", precinct.d_vote_share));
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
        EnactedDemographicsData enacted = analysisOpt.get().getEnactedDemographics();
        if (enacted == null || enacted.getDistricts() == null) return Optional.empty();

        // Districts won by the minority party of choice (Democratic for all groups)
        Set<Integer> demDistricts = new HashSet<>();
        if (state.getRepresentatives() != null) {
            for (Representative rep : state.getRepresentatives()) {
                if (Party.Democrat == rep.getParty()) demDistricts.add(rep.getDistrict());
            }
        }

        Map<String, Double> eiConf = EI_CONFIDENCE.getOrDefault(id, Map.of());
        Map<String, Integer> vapByGroup = state.getVap_by_group();
        int totalVap = state.getVoting_age_population();
        int totalDistricts = state.getNum_congressional_districts();
        List<String> feasibleGroups = state.getFeasible_demographic_groups();

        List<RoughProportionalityEntry> result = new ArrayList<>();

        for (Map.Entry<String, Double> confEntry : eiConf.entrySet()) {
            String group = confEntry.getKey();
            if ("white".equals(group)) continue;
            if (feasibleGroups != null && !feasibleGroups.contains(group)) continue;

            double eiConfidence = confEntry.getValue();
            int effectiveCount = 0;

            for (DistrictDemographics dd : enacted.getDistricts()) {
                if (!demDistricts.contains(dd.getDistrict())) continue;
                DemographicGroup dg = dd.getGroups() != null ? dd.getGroups().get(group) : null;
                if (dg == null) continue;
                double k = dg.getPct() / 100.0;
                double effectiveness = Math.min(2.0 * k, 1.0) * eiConfidence;
                if (effectiveness >= EFFECTIVENESS_THRESHOLD) effectiveCount++;
            }

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

        result.sort(Comparator.comparing(RoughProportionalityEntry::getGroup));
        return Optional.of(result);
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints points = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) points.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(points.toList());
    }
}
