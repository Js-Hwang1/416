package tigers.redistricting.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * React SPA fallback: any GET that doesn't match /api/**, /tiles/**, /static/**,
 * or a file in the React build root returns the build's index.html so the
 * client-side router can take over.
 */
@Controller
public class SpaFallbackController {

    @Value("${tigers.static-dir:client/build/}")
    private String staticDir;

    @GetMapping(value = {
        "/", "/{path:^(?!api|tiles|static|hello|mongo-test).*$}",
        "/{path:^(?!api|tiles|static|hello|mongo-test).*$}/**"
    })
    public ResponseEntity<Resource> index() {
        String dir = staticDir.endsWith("/") ? staticDir : staticDir + "/";
        Path path = Path.of(dir, "index.html");
        if (!Files.isReadable(path)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, MediaType.TEXT_HTML_VALUE)
            .header(HttpHeaders.CACHE_CONTROL, "no-cache, public")
            .body(new FileSystemResource(path));
    }
}
