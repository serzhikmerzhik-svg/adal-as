"use client";

import { DgisMap } from "./map/DgisMap";
import { LeafletMap } from "./map/LeafletMap";
import type { SchoolMapProps } from "./map/shared";

// 2GIS демо-кілті бір айға беріледі: кілт жоқ болса, карта OpenStreetMap-ке қайтады.
const DGIS_KEY = process.env.NEXT_PUBLIC_2GIS_KEY;

export function SchoolMap(props: SchoolMapProps) {
  return DGIS_KEY ? <DgisMap {...props} apiKey={DGIS_KEY} /> : <LeafletMap {...props} />;
}
