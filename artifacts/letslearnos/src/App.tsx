import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";

import { SessionProvider, useSession } from "@/context/SessionContext";
import ProfileSelect from "@/pages/profile-select";
import Home from "@/pages/home";
import MathPage from "@/pages/math";
import SpanishPage from "@/pages/spanish";
import GeographyPage from "@/pages/geography";
import WorldMapsPage from "@/pages/world-maps";
import CanadaPage from "@/pages/canada";
import CentralAmericaPage from "@/pages/central-america";
import SouthAmericaPage from "@/pages/south-america";
import SciencePage from "@/pages/science";
import SpacePage from "@/pages/space";
import SpaceDwarfsPage from "@/pages/space-dwarfs";
import ColoringPage from "@/pages/coloring";
import TracingPage from "@/pages/tracing";
import DotsPage from "@/pages/dots";
import MatchPage from "@/pages/match";
import UsaPage from "@/pages/usa";
import Progress from "@/pages/progress";
import PokedexPage from "@/pages/pokedex";
import RegionsPage from "@/pages/regions";
import WorksheetsPage from "@/pages/worksheets";
import PuzzlePage from "@/pages/puzzle";
import ShadowPage from "@/pages/shadow";
import StickersPage from "@/pages/stickers";
import PianoPage from "@/pages/piano";
import SeekPage from "@/pages/seek";
import SearchPage from "@/pages/search";
import StoriesPage from "@/pages/stories";
import MazePage from "@/pages/maze";
import RocketPage from "@/pages/rocket";
import NotFound from "@/pages/not-found";
import { ParentOverlay } from "@/components/ParentOverlay";
import { TopBar } from "@/components/TopBar";
import * as music from "@/lib/music";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 10, retry: 1 } },
});

function AppRoutes() {
  const { profile } = useSession();
  const [location] = useLocation();

  useEffect(() => {
    if (!profile) {
      music.stop();
      return;
    }
    // Learning modules are music-free so narration is clear; the completion
    // jingle still plays over silence when a module finishes.
    if (
      [
        "/math",
        "/spanish",
        "/geography",
        "/usa",
        "/world-maps",
        "/canada",
        "/central-america",
        "/south-america",
        "/science",
        "/space",
        "/space/dwarfs",
        "/coloring",
        "/tracing",
        "/dots",
        "/match",
        "/worksheets",
        "/puzzle",
        "/shadow",
        "/stickers",
        "/piano",
        "/seek",
        "/search",
        "/stories",
        "/maze",
        "/rocket",
      ].includes(location)
    )
      music.stop();
    else music.playScene("menu");
  }, [profile, location]);

  // Worksheets is a parent page (PIN-gated inside): reachable without a kid
  // session so a parent on another computer can print over an SSH tunnel
  // without starting screen time for a profile.
  if (!profile) {
    if (location === "/worksheets") return <WorksheetsPage />;
    return <ProfileSelect />;
  }

  return (
    <>
      <TopBar />
      {/* Reserve the 80px hardware-safe strip plus the 88px TopBar. */}
      <div className="pt-[168px] pb-4 min-h-screen">
        <AnimatePresence mode="wait">
          <Switch key={location}>
            <Route path="/home" component={Home} />
            <Route path="/math" component={MathPage} />
            <Route path="/spanish" component={SpanishPage} />
            <Route path="/geography" component={GeographyPage} />
            <Route path="/usa" component={UsaPage} />
            <Route path="/world-maps" component={WorldMapsPage} />
            <Route path="/canada" component={CanadaPage} />
            <Route path="/central-america" component={CentralAmericaPage} />
            <Route path="/south-america" component={SouthAmericaPage} />
            <Route path="/science" component={SciencePage} />
            <Route path="/space" component={SpacePage} />
            <Route path="/space/dwarfs" component={SpaceDwarfsPage} />
            <Route path="/coloring" component={ColoringPage} />
            <Route path="/tracing" component={TracingPage} />
            <Route path="/dots" component={DotsPage} />
            <Route path="/match" component={MatchPage} />
            <Route path="/progress" component={Progress} />
            <Route path="/pokedex" component={PokedexPage} />
            <Route path="/regions" component={RegionsPage} />
            <Route path="/worksheets" component={WorksheetsPage} />
            <Route path="/puzzle" component={PuzzlePage} />
            <Route path="/shadow" component={ShadowPage} />
            <Route path="/stickers" component={StickersPage} />
            <Route path="/piano" component={PianoPage} />
            <Route path="/seek" component={SeekPage} />
            <Route path="/search" component={SearchPage} />
            <Route path="/stories" component={StoriesPage} />
            <Route path="/maze" component={MazePage} />
            <Route path="/rocket" component={RocketPage} />
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </AnimatePresence>
      </div>
      <ParentOverlay />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
