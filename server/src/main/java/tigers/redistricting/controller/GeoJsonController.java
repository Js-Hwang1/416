package tigers.redistricting.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tigers.redistricting.enums.StateId;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

/**
 * Serves GeoJSON files directly from the filesystem. The directory is
 * configured via the {@code TIGERS_GEOJSON_DIR} env var (or the
 * {@code tigers.geojson-dir} application property), defaulting to
 * {@code geojson/} relative to the JVM working directory.
 *
 * Avoids MongoDB because the TX precincts file exceeds the 16 MB BSON
 * document limit. Streaming from disk also lets gzip in nginx (or any
 * reverse proxy) compress the response.
 */
@RestController
@RequestMapping("/api/states/{id}/geojson")
public class GeoJsonController {

    // Per-state, per-layer filename. Keep simple and explicit — the source
    // files have asymmetric naming (tx_vtds vs ma_precincts).
    private static final Map<String, Map<StateId, String>> FILENAMES = Map.of(
        "districts", Map.of(
            StateId.MA, "ma_congressional_districts.geojson",
            StateId.TX, "tx_congressional_districts.geojson"
        ),
        "precincts", Map.of(
            StateId.MA, "ma_precincts.geojson",
            StateId.TX, "tx_vtds.geojson"
        )
    );

    @Value("${tigers.geojson-dir:geojson}")
    private String geojsonDir;

    @GetMapping("/{type}")
    public ResponseEntity<Resource> getGeoJson(@PathVariable StateId id, @PathVariable String type) {
        Map<StateId, String> perState = FILENAMES.get(type.toLowerCase());
        if (perState == null) return ResponseEntity.notFound().build();
        String filename = perState.get(id);
        if (filename == null) return ResponseEntity.notFound().build();

        Path path = Path.of(geojsonDir, filename);
        if (!Files.isReadable(path)) return ResponseEntity.notFound().build();

        Resource resource = new FileSystemResource(path);
        long length;
        try { length = Files.size(path); } catch (Exception e) { return ResponseEntity.notFound().build(); }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, "application/geo+json")
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .contentLength(length)
            .body(resource);
    }
}
