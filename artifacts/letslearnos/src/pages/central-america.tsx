// Central America explorer — /central-america
// Configures the shared RegionMapExplorer (see components/RegionMapExplorer)
// with Central America's countries. Style/interaction match /usa.

import RegionMapExplorer, {
  type RegionFactData,
} from "@/components/RegionMapExplorer";
import {
  CENTRAL_AMERICA_MAP_VIEW_BOX,
  centralAmericaPaths,
} from "@/content/central-america-paths";
import {
  centralAmericaCountries,
  SMALL_COUNTRIES,
} from "@/content/central-america";

const NAME_BY_CODE = new Map(centralAmericaCountries.map((c) => [c.code, c.name]));

const PATHS = centralAmericaPaths.map((c) => ({
  id: c.code,
  name: NAME_BY_CODE.get(c.code) ?? c.code,
  d: c.d,
}));

const FACTS: Record<string, RegionFactData> = Object.fromEntries(
  centralAmericaCountries.map((c): [string, RegionFactData] => [
    c.code,
    { emoji: c.emoji, capital: c.capital, fact: c.fact },
  ]),
);

export default function CentralAmericaPage() {
  return (
    <RegionMapExplorer
      title="Central America"
      regionNoun="country"
      regionNounPlural="countries"
      introText="This is Central America! Tap a country to explore."
      viewBox={CENTRAL_AMERICA_MAP_VIEW_BOX}
      paths={PATHS}
      facts={FACTS}
      smallRegions={SMALL_COUNTRIES}
      findGoal={4}
      moduleId="central-america"
      backPath="/world-maps"
      backLabel="World Maps"
    />
  );
}
