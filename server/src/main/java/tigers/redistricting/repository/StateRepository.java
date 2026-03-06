package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.model.State;

public interface StateRepository extends MongoRepository<State, String> {
}
