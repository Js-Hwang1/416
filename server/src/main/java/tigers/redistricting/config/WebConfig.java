package tigers.redistricting.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/tiles/**")
                .addResourceLocations("file:tiles/")
                .setCachePeriod(86400);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:3000")
                .allowedMethods("GET", "HEAD", "OPTIONS")
                .exposedHeaders("Content-Range", "Accept-Ranges", "Content-Length");
    }
}
