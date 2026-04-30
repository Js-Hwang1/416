package tigers.redistricting.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Race {
    White, Black, Hispanic, Asian;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static Race fromString(String value) {
        for (Race race : Race.values()) {
            if (race.name().equalsIgnoreCase(value)) {
                return race;
            }
        }
        throw new IllegalArgumentException("Unknown race: " + value);
    }
}
