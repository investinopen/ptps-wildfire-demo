-- One source.coop fire-risk layer plus FIRMS active detections for a bounding box. Gets "risk" and "right now" on the same map with almost no auth friction.
-- https://docs.google.com/document/d/1rYsP1I1-TAd3Tu-G6EJ-5o7IbQIHf_dKT3DjH8IpQuo/edit?tab=t.0#heading=h.87di2doy0z55
CREATE OR REPLACE VIEW burn_prob_1km AS
SELECT *,
    ST_MakePoint(longitude, latitude) AS point
FROM read_parquet('data/burn_prob_1km/*.parquet');

COMMENT ON VIEW burn_prob_1km IS 'https://docs.carbonplan.org/ocr/en/latest/reference/data-schema.html#raster-tensor-datasets

Downloaded via burn_prob.ipynb.';


CREATE OR REPLACE VIEW county_burn_prob AS
SELECT *
FROM ST_Read(
        'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/carbonplan/carbonplan-ocr/output/fire-risk/vector/production/v1.1.0/region-analysis/counties/stats.geojson'
    );

COMMENT ON VIEW county_burn_prob IS 'https://open-climate-risk.readthedocs.io/en/latest/access-data.html#regional-statistics-downloads';


CREATE OR REPLACE VIEW fire_zones AS
SELECT *
FROM ST_Read(
        'zip://https://www.weather.gov/source/gis/Shapefiles/WSOM/fz16ap26.zip/fz16ap26.shp'
    );

COMMENT ON VIEW fire_zones IS 'https://www.weather.gov/gis/FireZones';


-- the geom is empty, so backfill it from the fire_zones
-- https://github.com/weather-gov/api/discussions/278
CREATE OR REPLACE VIEW red_flag_warnings AS WITH warnings AS (
        SELECT DISTINCT * EXCLUDE geom,
            unnest(affectedZones) AS zone_url,
            regexp_extract(
                zone_url,
                '^https://api.weather.gov/zones/fire/([A-Z]{2})Z(\d{3})$',
                ['state', 'zone']
            ) AS zone_parsed
        FROM ST_Read(
                'https://api.weather.gov/alerts/active?event=Red%20Flag%20Warning&status=actual' -- , open_options = ['FLATTEN_NESTED_ATTRIBUTES=YES']
            )
    ),
    zones_with_geom AS (
        SELECT warnings.* EXCLUDE (zone_url, zone_parsed),
            fire_zones.geom
        FROM warnings
            LEFT JOIN fire_zones ON warnings.zone_parsed.state = fire_zones.state
            AND warnings.zone_parsed.zone = fire_zones.zone
    )
SELECT zones_with_geom.* EXCLUDE geom,
    -- ST_Union_Agg seems to return a WKB, so cast it
    ST_Union_Agg(geom)::GEOMETRY AS geom
FROM zones_with_geom
GROUP BY ALL;

COMMENT ON VIEW red_flag_warnings IS 'https://www.weather.gov/documentation/services-web-api#/default/alerts_active, enriched with the combined geometries';


CREATE OR REPLACE VIEW active_fires AS
SELECT *
FROM 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv';

COMMENT ON VIEW active_fires IS '"Each MODIS active fire/thermal hotspot location represents the center of a 1km pixel that is flagged by the algorithm as containing one or more fires within the pixel."

- https://www.earthdata.nasa.gov/data/tools/firms
- https://firms.modaps.eosdis.nasa.gov/active_fire/#firms-txt';


CREATE OR REPLACE VIEW state_boundaries AS
SELECT *
FROM ST_Read(
        'zip://https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_state_20m.zip/cb_2018_us_state_20m.shp'
    );

COMMENT ON VIEW state_boundaries IS 'https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html';
