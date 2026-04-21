package tigers.redistricting.service;

import org.apache.commons.math3.fitting.PolynomialCurveFitter;
import org.apache.commons.math3.fitting.WeightedObservedPoints;
import org.springframework.stereotype.Service;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.*;
import tigers.redistricting.repository.AnalysisDataRepository;

import java.util.*;

@Service
public class AnalysisService {

    private static final int POLY_DEGREE = 3;

    private final AnalysisDataRepository analysisDataRepository;

    public AnalysisService(AnalysisDataRepository analysisDataRepository) {
        this.analysisDataRepository = analysisDataRepository;
    }

    /*
     * MongoDB: { hispanic: [{ precinct_id, name, total_pop, minority_pop, minority_vap_pct, d_vote_share }, ...], ... }
     * Response: { hispanic: [{ x: minority_vap_pct, y: d_vote_share }, ...], ... }
     */
    public Optional<Map<String, List<Map<String, Object>>>> getGinglesPrecinct(StateId id) {
        return analysisDataRepository.findById(id).map(ad -> {
            Map<String, List<PrecinctPoint>> byGroup = ad.getGinglesPrecinct();
            if (byGroup == null) return null;

            Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
            for (Map.Entry<String, List<PrecinctPoint>> groupEntry : byGroup.entrySet()) {
                List<Map<String, Object>> points = new ArrayList<>();
                for (PrecinctPoint precinct : groupEntry.getValue()) {
                    points.add(Map.of("x", precinct.minority_vap_pct, "y", precinct.d_vote_share));
                }
                result.put(groupEntry.getKey(), points);
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

            Map<String, double[]> result = new LinkedHashMap<>();
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

    public Optional<VoteSeatData> getVoteSeat(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getVoteSeat);
    }

    public Optional<MinorityEffectivenessData> getMinorityEffectiveness(StateId id) {
        return analysisDataRepository.findById(id).map(AnalysisData::getMinorityEffectiveness);
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints points = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) points.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(points.toList());
    }
}
