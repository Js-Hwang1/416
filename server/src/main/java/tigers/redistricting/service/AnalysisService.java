package tigers.redistricting.service;

import org.apache.commons.math3.fitting.PolynomialCurveFitter;
import org.apache.commons.math3.fitting.WeightedObservedPoints;
import org.springframework.stereotype.Service;
import tigers.redistricting.model.AnalysisData;
import tigers.redistricting.model.PrecinctPoint;
import tigers.redistricting.model.RegressionPoint;
import tigers.redistricting.repository.AnalysisDataRepository;

import java.util.*;

@Service
public class AnalysisService {

    private static final int POLY_DEGREE = 3;

    private final AnalysisDataRepository analysisDataRepository;

    public AnalysisService(AnalysisDataRepository analysisDataRepository) {
        this.analysisDataRepository = analysisDataRepository;
    }

    public Optional<AnalysisData> getByState(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr);
    }

    /*
     * MongoDB: { hispanic: [{ precinct_id, name, total_pop, minority_pop, minority_vap_pct, d_vote_share }, ...], ... }
     * Response: { hispanic: [{ x: minority_vap_pct, y: d_vote_share }, ...], ... }
     */
    public Optional<Map<String, Object>> getGinglesPrecinct(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Map<String, List<PrecinctPoint>> byGroup = ad.getGinglesPrecinct();
            if (byGroup == null) return null;

            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, List<PrecinctPoint>> groupEntry : byGroup.entrySet()) {
                // for each group (hispanic, black, asian...), strip each precinct down to just x and y
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
    public Optional<Map<String, Object>> getGinglesRegression(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Map<String, List<RegressionPoint>> byGroup = ad.getGinglesRegression();
            if (byGroup == null) return null;

            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, List<RegressionPoint>> groupEntry : byGroup.entrySet()) {
                // unpack the list of {x, y} points into two parallel arrays for the curve fitter
                List<RegressionPoint> rawPoints = groupEntry.getValue();
                double[] xs = new double[rawPoints.size()];
                double[] ys = new double[rawPoints.size()];
                for (int i = 0; i < rawPoints.size(); i++) {
                    xs[i] = rawPoints.get(i).x;
                    ys[i] = rawPoints.get(i).y;
                }
                // fit a polynomial to the curve points and store the coefficients
                result.put(groupEntry.getKey(), fitPolynomial(xs, ys));
            }
            return result;
        });
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints points = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) points.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(3).fit(points.toList());
    }
}
