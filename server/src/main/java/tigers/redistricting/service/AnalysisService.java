package tigers.redistricting.service;

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
                double[] coeffs = fitPolynomial(xs, ys, POLY_DEGREE);
                Map<String, Object> poly = new LinkedHashMap<>();
                poly.put("coeffs", coeffs);
                poly.put("xMin", xMin);
                poly.put("xMax", xMax);
                result.put(entry.getKey(), poly);
            }
            return result;
        });
    }

    private double[] fitPolynomial(double[] xs, double[] ys, int degree) {
        int n = degree + 1;
        double[][] A = new double[n][n];
        double[] b = new double[n];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                double sum = 0;
                for (double x : xs) sum += Math.pow(x, i + j);
                A[i][j] = sum;
            }
            double sum = 0;
            for (int k = 0; k < xs.length; k++) sum += Math.pow(xs[k], i) * ys[k];
            b[i] = sum;
        }
        return gaussianElimination(A, b);
    }

    private double[] gaussianElimination(double[][] A, double[] b) {
        int n = b.length;
        for (int col = 0; col < n; col++) {
            int pivot = col;
            for (int row = col + 1; row < n; row++) {
                if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
            }
            double[] tmp = A[col]; A[col] = A[pivot]; A[pivot] = tmp;
            double t = b[col]; b[col] = b[pivot]; b[pivot] = t;
            for (int row = col + 1; row < n; row++) {
                double factor = A[row][col] / A[col][col];
                b[row] -= factor * b[col];
                for (int j = col; j < n; j++) A[row][j] -= factor * A[col][j];
            }
        }
        double[] x = new double[n];
        for (int i = n - 1; i >= 0; i--) {
            x[i] = b[i];
            for (int j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
            x[i] /= A[i][i];
        }
        return x;
    }
}
