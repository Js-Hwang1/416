package tigers.redistricting.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "precinctHeatmaps")
public class PrecinctHeatmap {

    @Id
    private String id;

    private String stateAbbr;
    private String name;
    private int pop;
    private int vap;
    private double hispanic;
    private double black;
    private double asian;
    private double white;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStateAbbr() { return stateAbbr; }
    public void setStateAbbr(String stateAbbr) { this.stateAbbr = stateAbbr; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getPop() { return pop; }
    public void setPop(int pop) { this.pop = pop; }

    public int getVap() { return vap; }
    public void setVap(int vap) { this.vap = vap; }

    public double getHispanic() { return hispanic; }
    public void setHispanic(double hispanic) { this.hispanic = hispanic; }

    public double getBlack() { return black; }
    public void setBlack(double black) { this.black = black; }

    public double getAsian() { return asian; }
    public void setAsian(double asian) { this.asian = asian; }

    public double getWhite() { return white; }
    public void setWhite(double white) { this.white = white; }
}
