package tigers.redistricting.model;

import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;

public class EiKdeData {
    @Field("Black")
    private List<RegressionPoint> black;

    @Field("Hispanic")
    private List<RegressionPoint> hispanic;

    @Field("Asian")
    private List<RegressionPoint> asian;

    @Field("White")
    private List<RegressionPoint> white;

    public List<RegressionPoint> getBlack() { return black; }
    public void setBlack(List<RegressionPoint> black) { this.black = black; }

    public List<RegressionPoint> getHispanic() { return hispanic; }
    public void setHispanic(List<RegressionPoint> hispanic) { this.hispanic = hispanic; }

    public List<RegressionPoint> getAsian() { return asian; }
    public void setAsian(List<RegressionPoint> asian) { this.asian = asian; }

    public List<RegressionPoint> getWhite() { return white; }
    public void setWhite(List<RegressionPoint> white) { this.white = white; }
}
