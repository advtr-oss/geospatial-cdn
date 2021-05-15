# The @advtr/geospatial CDN

[![Build](https://github.com/advtr-oss/geospatial-cdn/actions/workflows/build.yml/badge.svg?event=schedule)](https://github.com/advtr-oss/geospatial-cdn/actions/workflows/build.yml)

> Thanks for the way [CocoaPod's CDN](https://github.com/CocoaPods/cdn.cocoapods.org) works

To reduce cost and build time when updating our databases to keep places up to date this idea was grown.

## How the CDN is used

### Serving Static Data

In this guise it is a parser of [`mledoze/countries`](https://github.com/mledoze/countries) that fixes any GeoJSON issues, and allows the GeoJSON and flag
files to be accessed via `https://cdn.advtr.co.uk/static/{flag|geojson}/{ISO 3166 Alpha-3}.{svg|geo.json}`. This will help speed up request data inside MongoDB by removing
the need for the GeoJSON of the countries to be stored there.

### Data Ingestion

Here we will be porting the raw ingestable data from both [`Geonames`](https://www.geonames.org) and [`mledoze/countries`](https://github.com/mledoze/countries)
and allowing it to be accessible via `https://cdn.advtr.co.uk/data/*` URL, this will reduce a process when updating both databases, and fits into the new `@advtr/geospatial-ingest`
architecture. Where `@advtr/geospatial-ingest` becomes a fit of purpose event handler, and not a full processing tool like so:

```text
@advtr/geospatial-cdn -> @advtr/geospatial-ingest -> {Kafka|Outputs}
```

