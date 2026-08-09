-- One source.coop fire-risk layer plus FIRMS active detections for a bounding box. Gets "risk" and "right now" on the same map with almost no auth friction.
-- https://docs.google.com/document/d/1rYsP1I1-TAd3Tu-G6EJ-5o7IbQIHf_dKT3DjH8IpQuo/edit?tab=t.0#heading=h.87di2doy0z55
CREATE OR REPLACE VIEW burn_prob_1km AS
SELECT *,
    ST_MakeEnvelope(
        longitude - (990 / (111320.0 * COS(RADIANS(latitude)))) / 2.0,
        latitude - (990 / 111320.0) / 2.0,
        longitude + (990 / (111320.0 * COS(RADIANS(latitude)))) / 2.0,
        latitude + (990 / 111320.0) / 2.0
    ) AS geom
FROM read_parquet('/tmp/burn_prob_1km/*.parquet');

COMMENT ON VIEW burn_prob_1km IS 'See fire.ipynb for details.';


CREATE OR REPLACE VIEW county_burn_prob AS
SELECT *
FROM ST_Read(
        'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/carbonplan/carbonplan-ocr/output/fire-risk/vector/production/v1.1.0/region-analysis/counties/stats.geojson'
    );

COMMENT ON VIEW county_burn_prob IS 'https://open-climate-risk.readthedocs.io/en/latest/access-data.html#regional-statistics-downloads';


CREATE OR REPLACE VIEW active_fires AS
SELECT *
FROM 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv';

COMMENT ON VIEW active_fires IS '"Each MODIS active fire/thermal hotspot location represents the center of a 1km pixel that is flagged by the algorithm as containing one or more fires within the pixel."

- https://www.earthdata.nasa.gov/data/tools/firms
- https://firms.modaps.eosdis.nasa.gov/active_fire/#firms-txt';
