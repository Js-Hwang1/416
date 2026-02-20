// PrecinctRepository.java
//
// Spring Data MongoDB repository for Precinct documents.
//
// Declaration:
//   public interface PrecinctRepository extends MongoRepository<Precinct, String>
//
// Custom query methods:
//   List<Precinct> findByStateId(String stateId);
//   List<Precinct> findByStateIdAndDistrictId(String stateId, String districtId);
//
// Note: For spatial queries (bounding box), you may need @Query with
// MongoDB's $geoWithin operator, or use MongoTemplate for more control.
