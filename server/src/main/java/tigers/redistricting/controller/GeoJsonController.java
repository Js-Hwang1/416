package tigers.redistricting.controller;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.StateId;
import tigers.redistricting.model.DistrictGeoJson;
import tigers.redistricting.model.PrecinctGeoJson;
import tigers.redistricting.service.GeoJsonService;

@RestController
@RequestMapping("/api/states/{id}/geojson")
public class GeoJsonController {

    private final GeoJsonService geoJsonService;

    public GeoJsonController(GeoJsonService geoJsonService) {
        this.geoJsonService = geoJsonService;
    }

    @Cacheable("districtGeoJson")
    @GetMapping("/districts")
    public ResponseEntity<DistrictGeoJson> getDistricts(@PathVariable StateId id) {
        return geoJsonService.getDistrictGeoJson(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Cacheable("precinctGeoJson")
    @GetMapping("/precincts")
    public ResponseEntity<PrecinctGeoJson> getPrecincts(@PathVariable StateId id) {
        return geoJsonService.getPrecinctGeoJson(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
