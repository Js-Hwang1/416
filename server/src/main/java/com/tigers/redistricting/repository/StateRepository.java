// StateRepository.java
//
// Spring Data MongoDB repository for State documents.
//
// Declaration:
//   public interface StateRepository extends MongoRepository<State, String>
//
// Spring auto-implements CRUD methods (findAll, findById, save, delete, etc.)
//
// Custom query methods (add as needed):
//   Optional<State> findByName(String name);
//   Optional<State> findByFipsCode(String fipsCode);
//
// No @Repository annotation needed — Spring detects it from MongoRepository.
