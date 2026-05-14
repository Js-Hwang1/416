package tigers.redistricting.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.*;

import java.util.concurrent.TimeUnit;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // All paths are configurable via env vars or application.yaml so the same
    // JAR works locally (relative paths) and on a server (absolute paths).
    @Value("${tigers.tiles-dir:tiles/}")
    private String tilesDir;

    // React production build location. Locally: "client/build/" relative to repo
    // root or the server cwd. On the droplet: /var/www/tigers/.
    @Value("${tigers.static-dir:client/build/}")
    private String staticDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // /tiles/* — pmtiles binaries. Range requests handled natively by Spring Boot.
        String tiles = ensureTrailingSlash(tilesDir);
        registry.addResourceHandler("/tiles/**")
                .addResourceLocations("file:" + tiles)
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        // /static/* — hash-named React assets (long-cache friendly).
        String stat = ensureTrailingSlash(staticDir);
        registry.addResourceHandler("/static/**")
                .addResourceLocations("file:" + stat + "static/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());

        // / (and unmatched paths) — serve files from the build root.
        // index.html gets a short cache so deploys propagate quickly.
        registry.addResourceHandler("/**")
                .addResourceLocations("file:" + stat)
                .setCacheControl(CacheControl.noCache().cachePublic())
                .resourceChain(true);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Allow the React dev server (npm start on :3000) to hit the API.
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:3000", "http://localhost:3001")
                .allowedMethods("GET", "HEAD", "OPTIONS")
                .exposedHeaders("Content-Range", "Accept-Ranges", "Content-Length");
    }

    private static String ensureTrailingSlash(String s) {
        return s.endsWith("/") ? s : s + "/";
    }
}
