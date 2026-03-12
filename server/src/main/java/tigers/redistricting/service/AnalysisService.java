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

    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getGinglesPrecinct(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Object raw = ad.getGinglesPrecinct();
            if (!(raw instanceof Map)) return null;
            Map<String, Object> groups = (Map<String, Object>) raw;
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : groups.entrySet()) {
                List<?> points = (List<?>) entry.getValue();
                List<Map<String, Object>> compact = new ArrayList<>();
                for (Object p : points) {
                    Map<String, Object> point = (Map<String, Object>) p;
                    compact.add(Map.of("x", point.get("minority_vap_pct"), "y", point.get("d_vote_share")));
                }
                result.put(entry.getKey(), compact);
            }
            return result;
        });
    }

    @SuppressWarnings("unchecked")
    public Optional<Map<String, Object>> getGinglesRegression(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr).map(ad -> {
            Object raw = ad.getGinglesRegression();
            if (!(raw instanceof Map)) return null;
            Map<String, Object> groups = (Map<String, Object>) raw;
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : groups.entrySet()) {
                List<?> points = (List<?>) entry.getValue();
                double[] xs = new double[points.size()];
                double[] ys = new double[points.size()];
                for (int i = 0; i < points.size(); i++) {
                    Map<String, Object> p = (Map<String, Object>) points.get(i);
                    xs[i] = ((Number) p.get("x")).doubleValue();
                    ys[i] = ((Number) p.get("y")).doubleValue();
                }
                result.put(entry.getKey(), fitPolynomial(xs, ys));
            }
            return result;
        });
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints obs = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) {
            obs.add(xs[i], ys[i]);
        }
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(obs.toList());
    }
}
