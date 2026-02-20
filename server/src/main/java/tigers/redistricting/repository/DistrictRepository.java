// DistrictRepository.java
//
// Spring Data MongoDB repository for District documents.
//
// Declaration:
//   public interface DistrictRepository extends MongoRepository<District, String>
//
// Custom query methods:
//   List<District> findByStateId(String stateId);
//   List<District> findByStateIdAndPlanType(String stateId, String planType);
