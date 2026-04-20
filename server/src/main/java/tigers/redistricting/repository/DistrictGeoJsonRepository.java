package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.DistrictGeoJson;

public interface DistrictGeoJsonRepository extends MongoRepository<DistrictGeoJson, StateId> {
}
