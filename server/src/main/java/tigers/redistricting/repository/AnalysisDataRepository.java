package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.model.AnalysisData;

import java.util.Optional;

public interface AnalysisDataRepository extends MongoRepository<AnalysisData, String> {
    Optional<AnalysisData> findByStateAbbr(String stateAbbr);
}
