// South America explorer — /south-america
// Configures the shared RegionMapExplorer (see components/RegionMapExplorer)
// with South America's countries. Style/interaction match /usa.

import RegionMapExplorer, {
  type RegionFactData,
} from "@/components/RegionMapExplorer";
import {
  SOUTH_AMERICA_MAP_VIEW_BOX,
  southAmericaPaths,
} from "@/content/south-america-paths";
import {
  southAmericaCountries,
  SMALL_COUNTRIES,
} from "@/content/south-america";

const NAME_BY_CODE = new Map(southAmericaCountries.map((c) => [c.code, c.name]));

const PATHS = southAmericaPaths.map((c) => ({
  id: c.code,
  name: NAME_BY_CODE.get(c.code) ?? c.code,
  d: c.d,
}));

const FACTS: Record<string, RegionFactData> = Object.fromEntries(
  southAmericaCountries.map((c): [string, RegionFactData] => [
    c.code,
    { emoji: c.emoji, capital: c.capital, fact: c.fact },
  ]),
);

export default function SouthAmericaPage() {
  return (
    <RegionMapExplorer
      title="South America"
      regionNoun="country"
      regionNounPlural="countries"
      introText="This is South America! Tap a country to explore."
      viewBox={SOUTH_AMERICA_MAP_VIEW_BOX}
      paths={PATHS}
      facts={FACTS}
      smallRegions={SMALL_COUNTRIES}
      findGoal={5}
      moduleId="south-america"
      backPath="/world-maps"
      backLabel="World Maps"
    />
  );
}
