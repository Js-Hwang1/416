package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.AnalysisData;

public interface AnalysisDataRepository extends MongoRepository<AnalysisData, StateId> {
}
