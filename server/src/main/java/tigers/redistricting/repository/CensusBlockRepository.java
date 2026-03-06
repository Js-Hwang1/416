package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.model.CensusBlock;

import java.util.List;
import java.util.Optional;

public interface CensusBlockRepository extends MongoRepository<CensusBlock, String> {
    List<CensusBlock> findByStateAbbr(String stateAbbr);
    Optional<CensusBlock> findByGeoid(String geoid);
}
