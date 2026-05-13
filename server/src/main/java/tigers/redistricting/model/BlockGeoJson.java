package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import tigers.redistricting.enums.StateId;

import java.util.List;
import java.util.Map;

@Document(collection = "blockGeoJson")
public class BlockGeoJson {

    @Id
    private StateId id;

    private String type;
    private List<Map<String, Object>> features;

    public StateId getId() { return id; }
    public void setId(StateId id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public List<Map<String, Object>> getFeatures() { return features; }
    public void setFeatures(List<Map<String, Object>> features) { this.features = features; }
}
