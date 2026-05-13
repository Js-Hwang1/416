package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.BlockGeoJson;

public interface BlockGeoJsonRepository extends MongoRepository<BlockGeoJson, StateId> {
}
