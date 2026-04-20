package tigers.redistricting;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@EnableCaching
@SpringBootApplication(scanBasePackages = "tigers")
public class RedistrictingApplication {
    public static void main(String[] args) {
        SpringApplication.run(RedistrictingApplication.class, args);
    }
}
