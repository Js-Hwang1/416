package com.example.demo;

import java.time.Instant;
import java.util.Map;

import org.bson.Document;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class DemoApplication {
    private final MongoTemplate mongoTemplate;

    public DemoApplication(MongoTemplate mongoTemplate) {
      this.mongoTemplate = mongoTemplate;
    }

    public static void main(String[] args) {
      SpringApplication.run(DemoApplication.class, args);
    }

    @GetMapping("/hello")
    public String hello(@RequestParam(value = "name", defaultValue = "World") String name) {
      return String.format("Hello %s!", name);
    }

    @GetMapping("/mongo-test")
    public Map<String, Object> mongoTest() {
      Document doc = new Document("message", "MongoDB connection works")
          .append("createdAt", Instant.now().toString());

      mongoTemplate.getCollection("connection_test").insertOne(doc);
      long count = mongoTemplate.getCollection("connection_test").countDocuments();

      return Map.of(
          "database", mongoTemplate.getDb().getName(),
          "collection", "connection_test",
          "documentsInCollection", count,
          "lastInsertedId", String.valueOf(doc.getObjectId("_id")));
    }
}
