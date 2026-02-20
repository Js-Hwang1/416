// MongoConfig.java
//
// MongoDB connection configuration.
//
// Annotations:
//   @Configuration
//
// Responsibilities:
//   - Override default MongoDB settings if needed (custom database name, URI, etc.)
//   - Register custom converters (e.g., GeoJSON geometry types if Spring doesn't
//     handle them automatically)
//   - Most basic cases need NO code here — Spring auto-configures from
//     application.properties. This file exists for when you need to customize.
//
// Coordinate with Karen (database team) on:
//   - MongoDB connection URI (localhost vs Atlas vs Docker)
//   - Database name
//   - Collection naming conventions
