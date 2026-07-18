// Canada explorer — /canada
// Configures the shared RegionMapExplorer (see components/RegionMapExplorer)
// with Canada's provinces & territories. Style/interaction match /usa.

import RegionMapExplorer, {
  type RegionFactData,
} from "@/components/RegionMapExplorer";
import { CANADA_MAP_VIEW_BOX, provincePaths } from "@/content/canada-paths";
import { canadianProvinces, SMALL_PROVINCES } from "@/content/canada";

const NAME_BY_CODE = new Map(canadianProvinces.map((p) => [p.code, p.name]));

const PATHS = provincePaths.map((p) => ({
  id: p.code,
  name: NAME_BY_CODE.get(p.code) ?? p.code,
  d: p.d,
}));

const FACTS: Record<string, RegionFactData> = Object.fromEntries(
  canadianProvinces.map((p): [string, RegionFactData] => [
    p.code,
    { emoji: p.emoji, capital: p.capital, fact: p.fact },
  ]),
);

export default function CanadaPage() {
  return (
    <RegionMapExplorer
      title="Canada"
      regionNoun="province"
      regionNounPlural="provinces"
      introText="This is Canada! Tap a province to explore."
      viewBox={CANADA_MAP_VIEW_BOX}
      paths={PATHS}
      facts={FACTS}
      smallRegions={SMALL_PROVINCES}
      findGoal={5}
      moduleId="canada"
      backPath="/world-maps"
      backLabel="World Maps"
    />
  );
}
