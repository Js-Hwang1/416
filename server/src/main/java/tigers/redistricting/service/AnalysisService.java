package tigers.redistricting.service;

import org.springframework.stereotype.Service;
import tigers.redistricting.model.AnalysisData;
import tigers.redistricting.repository.AnalysisDataRepository;

import java.util.Optional;

@Service
public class AnalysisService {

    private final AnalysisDataRepository analysisDataRepository;

    public AnalysisService(AnalysisDataRepository analysisDataRepository) {
        this.analysisDataRepository = analysisDataRepository;
    }

    public Optional<AnalysisData> getByState(String stateAbbr) {
        return analysisDataRepository.findById(stateAbbr);
    }
}
