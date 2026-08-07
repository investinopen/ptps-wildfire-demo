-- One source.coop fire-risk layer plus FIRMS active detections for a bounding box. Gets "risk" and "right now" on the same map with almost no auth friction.
-- https://docs.google.com/document/d/1rYsP1I1-TAd3Tu-G6EJ-5o7IbQIHf_dKT3DjH8IpQuo/edit?tab=t.0#heading=h.87di2doy0z55

-- "Each MODIS active fire/thermal hotspot location represents the center of a 1km pixel that is flagged by the algorithm as containing one or more fires within the pixel."
-- https://www.earthdata.nasa.gov/data/tools/firms
SELECT *
-- https://firms.modaps.eosdis.nasa.gov/active_fire/#firms-txt
FROM 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv'
LIMIT 10;
