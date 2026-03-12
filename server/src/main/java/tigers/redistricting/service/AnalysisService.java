package tigers.redistricting.service;

import org.apache.commons.math3.fitting.PolynomialCurveFitter;
import org.apache.commons.math3.fitting.WeightedObservedPoints;
import org.springframework.stereotype.Service;
import tigers.redistricting.model.AnalysisData;
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

    // Returns {group -> [{x, y}]} 
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getGinglesPrecinct(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Object raw = ad.getGinglesPrecinct();
            if (!(raw instanceof Map)) return null;
            Map<String, Object> byGroup = (Map<String, Object>) raw;
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, Object> groupEntry : byGroup.entrySet()) {
                List<?> rawPoints = (List<?>) groupEntry.getValue();
                List<Map<String, Object>> points = new ArrayList<>();
                for (Object rawPoint : rawPoints) {
                    Map<String, Object> precinct = (Map<String, Object>) rawPoint;
                    points.add(Map.of("x", precinct.get("minority_vap_pct"), "y", precinct.get("d_vote_share")));
                }
                result.put(groupEntry.getKey(), points);
            }
            return result;
        });
    }

    // Returns {group -> [a0, a1, a2, a3]} 
    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getGinglesRegression(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Object raw = ad.getGinglesRegression();
            if (!(raw instanceof Map)) return null;
            Map<String, Object> byGroup = (Map<String, Object>) raw;
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, Object> groupEntry : byGroup.entrySet()) {
                List<?> rawPoints = (List<?>) groupEntry.getValue();
                double[] xs = new double[rawPoints.size()];
                double[] ys = new double[rawPoints.size()];
                for (int i = 0; i < rawPoints.size(); i++) {
                    Map<String, Object> point = (Map<String, Object>) rawPoints.get(i);
                    xs[i] = ((Number) point.get("x")).doubleValue();
                    ys[i] = ((Number) point.get("y")).doubleValue();
                }
                result.put(groupEntry.getKey(), fitPolynomial(xs, ys));
            }
            return result;
        });
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints points = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) points.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(points.toList());
    }
}
