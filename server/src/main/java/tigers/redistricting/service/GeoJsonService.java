package tigers.redistricting.service;

import org.springframework.stereotype.Service;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.BlockGeoJson;
import tigers.redistricting.model.DistrictGeoJson;
import tigers.redistricting.model.PrecinctGeoJson;
import tigers.redistricting.repository.BlockGeoJsonRepository;
import tigers.redistricting.repository.DistrictGeoJsonRepository;
import tigers.redistricting.repository.PrecinctGeoJsonRepository;

import java.util.Optional;

@Service
public class GeoJsonService {

    private final DistrictGeoJsonRepository districtGeoJsonRepository;
    private final PrecinctGeoJsonRepository precinctGeoJsonRepository;
    private final BlockGeoJsonRepository blockGeoJsonRepository;

    public GeoJsonService(DistrictGeoJsonRepository districtGeoJsonRepository,
                          PrecinctGeoJsonRepository precinctGeoJsonRepository,
                          BlockGeoJsonRepository blockGeoJsonRepository) {
        this.districtGeoJsonRepository = districtGeoJsonRepository;
        this.precinctGeoJsonRepository = precinctGeoJsonRepository;
        this.blockGeoJsonRepository = blockGeoJsonRepository;
    }

    public Optional<DistrictGeoJson> getDistrictGeoJson(StateId id) {
        return districtGeoJsonRepository.findById(id);
    }

    public Optional<PrecinctGeoJson> getPrecinctGeoJson(StateId id) {
        return precinctGeoJsonRepository.findById(id);
    }

    public Optional<BlockGeoJson> getBlockGeoJson(StateId id) {
        return blockGeoJsonRepository.findById(id);
    }
}
