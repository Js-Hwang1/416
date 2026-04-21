package tigers.redistricting.enums;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum Race {
    White, Black, Hispanic, Asian;

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
