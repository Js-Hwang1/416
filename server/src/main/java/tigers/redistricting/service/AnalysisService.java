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
                    Map<String, Object> c = new LinkedHashMap<>();
                    c.put("x", point.get("minority_vap_pct"));
                    c.put("y", point.get("d_vote_share"));
                    c.put("name", point.get("name"));
                    c.put("id", point.get("precinct_id"));
                    c.put("pop", point.get("total_pop"));
                    compact.add(c);
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
                double xMin = Double.MAX_VALUE, xMax = -Double.MAX_VALUE;
                for (int i = 0; i < points.size(); i++) {
                    Map<String, Object> p = (Map<String, Object>) points.get(i);
                    double x = ((Number) p.get("x")).doubleValue();
                    double y = ((Number) p.get("y")).doubleValue();
                    xs[i] = x;
                    ys[i] = y;
                    if (x < xMin) xMin = x;
                    if (x > xMax) xMax = x;
                }
                double[] coeffs = fitPolynomial(xs, ys);
                Map<String, Object> poly = new LinkedHashMap<>();
                poly.put("coeffs", coeffs);
                poly.put("xMin", xMin);
                poly.put("xMax", xMax);
                result.put(entry.getKey(), poly);
            }
            return result;
        });
    }

    private double[] fitPolynomial(double[] xs, double[] ys) {
        WeightedObservedPoints obs = new WeightedObservedPoints();
        for (int i = 0; i < xs.length; i++) obs.add(xs[i], ys[i]);
        return PolynomialCurveFitter.create(POLY_DEGREE).fit(obs.toList());
    }
}
