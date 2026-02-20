// WebConfig.java
//
// Web/CORS configuration so the frontend client can call this API.
//
// Annotations:
//   @Configuration
//
// Responsibilities:
//   - Implement WebMvcConfigurer and override addCorsMappings()
//   - Allow origins from the client dev server (e.g., http://localhost:3000)
//   - Allow methods: GET, POST, PUT, DELETE
//   - Allow headers: Content-Type, Authorization
//
// Without this, browser security will block the frontend from
// calling the backend API due to same-origin policy.
