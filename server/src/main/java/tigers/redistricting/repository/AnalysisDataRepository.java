package tigers.redistricting.repository;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.AnalysisData;

import java.util.Optional;

public interface AnalysisDataRepository extends MongoRepository<AnalysisData, StateId> {
    @Cacheable("analysisData")
    Optional<AnalysisData> findById(StateId id);
}
