// StateControllerTest.java
//
// Unit/integration tests for the StateController REST endpoints.
//
// Annotations:
//   @WebMvcTest(StateController.class)   — loads only the web layer, not full app
//   @MockBean StateService               — mock the service layer
//
// Tests:
//   testGetAllStates()       — mock service to return [MA, TX], assert 200 + JSON array
//   testGetStateById()       — mock service to return MA, assert 200 + correct fields
//   testGetStateNotFound()   — mock service to return empty, assert 404
//
// Uses MockMvc to simulate HTTP requests without starting a real server.
