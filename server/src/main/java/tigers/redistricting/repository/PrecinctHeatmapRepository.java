package tigers.redistricting.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tigers.redistricting.model.PrecinctHeatmap;

import java.util.List;

public interface PrecinctHeatmapRepository extends MongoRepository<PrecinctHeatmap, String> {
    List<PrecinctHeatmap> findByStateAbbr(String stateAbbr);
}
