-- https://duckdb.org/docs/current/core_extensions/httpfs/overview#installation-and-loading
INSTALL httpfs;
LOAD httpfs;

-- https://duckdb.org/docs/current/core_extensions/spatial/overview#installing-and-loading
INSTALL spatial;
LOAD spatial;

-- https://docs.source.coop/data-proxy
-- https://github.com/source-cooperative/docs.source.coop/pull/29
CREATE OR REPLACE SECRET source_coop (
    TYPE s3,
    PROVIDER config,
    ENDPOINT 'data.source.coop',
    URL_STYLE 'path'
    -- If you're working with multiple S3-compatible sources (beyond the Data Proxy), you'll want to only apply this SECRET to the Source Cooperative account name(s).
    -- https://duckdb.org/docs/current/configuration/secrets_manager#creating-multiple-secrets-for-the-same-service-type
    -- SCOPE 's3://kerner-lab'
);
