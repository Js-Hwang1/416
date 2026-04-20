package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.PrecinctGeoJson;

public interface PrecinctGeoJsonRepository extends MongoRepository<PrecinctGeoJson, StateId> {
}
