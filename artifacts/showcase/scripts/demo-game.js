(() => {
  const sampler = document.querySelector("[data-demo-sampler]");
  if (!sampler) return;

  const experienceCopy = {
    math: ["NUMBER GARDEN", "Find the missing number"],
    planets: ["SPACE EXPLORER", "Meet the planets"],
    rocket: ["ROCKET LAUNCH", "Count down to liftoff"],
    globe: ["GLOBE EXPLORER", "Choose a continent"],
    safety: ["FIRE SAFETY", "Practice the safest first move"],
    countries: ["MAP & COUNTRIES", "Find places and capitals"],
  };

  const experienceTabs = [...sampler.querySelectorAll("[data-experience-tab]")];
  const experiencePanels = [
    ...sampler.querySelectorAll("[data-experience-panel]"),
  ];
  const experienceKicker = sampler.querySelector("[data-experience-kicker]");
  const experienceTitle = sampler.querySelector("[data-experience-title]");
  const experienceNumber = sampler.querySelector("[data-experience-number]");

  function selectExperience(id, moveFocus = false) {
    const selectedIndex = experienceTabs.findIndex(
      (tab) => tab.dataset.experienceTab === id,
    );
    if (selectedIndex < 0) return;

    experienceTabs.forEach((tab, index) => {
      const selected = index === selectedIndex;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });

    experiencePanels.forEach((panel) => {
      panel.hidden = panel.dataset.experiencePanel !== id;
    });

    const copy = experienceCopy[id];
    experienceKicker.textContent = copy[0];
    experienceTitle.textContent = copy[1];
    experienceNumber.textContent = String(selectedIndex + 1);
  }

  experienceTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      selectExperience(tab.dataset.experienceTab);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + experienceTabs.length) % experienceTabs.length;
      } else if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % experienceTabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = experienceTabs.length - 1;
      }
      selectExperience(experienceTabs[nextIndex].dataset.experienceTab, true);
    });
  });
  selectExperience("math");

  const game = sampler.querySelector("[data-demo-game]");
  const questions = [
    { left: 2, total: 5, answer: 3, choices: [1, 3, 4, 6] },
    { left: 4, total: 10, answer: 6, choices: [5, 6, 7, 8] },
    { left: 1, total: 7, answer: 6, choices: [3, 5, 6, 7] },
    { left: 5, total: 9, answer: 4, choices: [2, 3, 4, 5] },
    { left: 3, total: 8, answer: 5, choices: [4, 5, 6, 7] },
  ];
  const round = game.querySelector("[data-round]");
  const stars = game.querySelector("[data-stars]");
  const left = game.querySelector("[data-left]");
  const total = game.querySelector("[data-total]");
  const answers = [...game.querySelectorAll("[data-answer]")];
  const feedback = game.querySelector("[data-feedback]");
  const next = game.querySelector("[data-next]");
  const mathReset = game.querySelector("[data-reset]");
  const equation = game.querySelector(".equation");
  let questionIndex = 0;
  let starCount = 0;

  function renderQuestion() {
    const question = questions[questionIndex];
    round.textContent = String(questionIndex + 1);
    stars.textContent = String(starCount);
    left.textContent = String(question.left);
    total.textContent = String(question.total);
    equation.setAttribute(
      "aria-label",
      `${question.left} plus a missing number equals ${question.total}`,
    );
    feedback.textContent =
      "Choose the number that makes the equation complete.";
    feedback.className = "game-feedback";
    next.hidden = true;

    answers.forEach((button, index) => {
      const value = question.choices[index];
      button.textContent = String(value);
      button.dataset.answer = String(value);
      button.disabled = false;
      button.className = "";
      button.setAttribute("aria-label", `Choose ${value}`);
    });
  }

  function chooseAnswer(event) {
    const button = event.currentTarget;
    const question = questions[questionIndex];
    const choice = Number(button.dataset.answer);

    if (choice !== question.answer) {
      button.classList.add("answer-try-again");
      feedback.textContent = "Nice thinking—try one more number.";
      feedback.className = "game-feedback game-feedback-gentle";
      window.setTimeout(() => button.classList.remove("answer-try-again"), 450);
      return;
    }

    starCount += 1;
    stars.textContent = String(starCount);
    button.classList.add("answer-correct");
    answers.forEach((answerButton) => {
      answerButton.disabled = true;
    });
    feedback.textContent = "You found it! A new star is growing.";
    feedback.className = "game-feedback game-feedback-success";
    next.hidden = false;
    next.textContent =
      questionIndex === questions.length - 1
        ? "Grow another garden"
        : "Next garden";
  }

  function advanceMath() {
    if (questionIndex === questions.length - 1) {
      questionIndex = 0;
      starCount = 0;
    } else {
      questionIndex += 1;
    }
    renderQuestion();
  }

  answers.forEach((button) => button.addEventListener("click", chooseAnswer));
  next.addEventListener("click", advanceMath);
  mathReset.addEventListener("click", () => {
    questionIndex = 0;
    starCount = 0;
    renderQuestion();
  });
  renderQuestion();

  const planetFacts = {
    sun: [
      "OUR STAR",
      "The Sun",
      "The Sun is a star. Its light and warmth make life on Earth possible.",
      "Center of our solar system",
    ],
    mercury: [
      "SMALLEST WORLD",
      "Mercury",
      "Mercury is the closest planet to the Sun and races around it faster than any other planet.",
      "First planet from the Sun",
    ],
    venus: [
      "CLOUDY WORLD",
      "Venus",
      "Venus is wrapped in thick clouds and is the hottest planet in our solar system.",
      "Second planet from the Sun",
    ],
    earth: [
      "BLUE WORLD",
      "Earth",
      "Earth is our home and the only known world with oceans of liquid water on its surface.",
      "Third planet from the Sun",
    ],
    mars: [
      "RUSTY WORLD",
      "Mars",
      "Iron minerals give Mars its red color. It is home to the solar system's largest volcano.",
      "Fourth planet from the Sun",
    ],
    jupiter: [
      "GIANT WORLD",
      "Jupiter",
      "Jupiter is the largest planet. Its Great Red Spot is a storm wider than Earth.",
      "Fifth planet from the Sun",
    ],
    saturn: [
      "RINGED WORLD",
      "Saturn",
      "Saturn's bright rings are made of countless pieces of ice and rock.",
      "Sixth planet from the Sun",
    ],
    uranus: [
      "SIDEWAYS WORLD",
      "Uranus",
      "Uranus rotates on its side, making its seasons unlike those of any other planet.",
      "Seventh planet from the Sun",
    ],
    neptune: [
      "WINDY WORLD",
      "Neptune",
      "Neptune is a deep-blue ice giant with some of the fastest winds in the solar system.",
      "Eighth planet from the Sun",
    ],
  };
  const planetButtons = [...sampler.querySelectorAll("[data-planet]")];
  const planetDots = [...sampler.querySelectorAll("[data-planet-dot]")];
  const planetKicker = sampler.querySelector("[data-planet-kicker]");
  const planetName = sampler.querySelector("[data-planet-name]");
  const planetFact = sampler.querySelector("[data-planet-fact]");
  const planetDetail = sampler.querySelector("[data-planet-detail]");

  function selectPlanet(id) {
    const fact = planetFacts[id];
    planetKicker.textContent = fact[0];
    planetName.textContent = fact[1];
    planetFact.textContent = fact[2];
    planetDetail.textContent = fact[3];
    planetButtons.forEach((button) => {
      const selected = button.dataset.planet === id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    planetDots.forEach((dot) => {
      dot.classList.toggle("is-selected", dot.dataset.planetDot === id);
    });
  }
  planetButtons.forEach((button) => {
    button.addEventListener("click", () => selectPlanet(button.dataset.planet));
  });

  const rocketStage = sampler.querySelector("[data-rocket-stage]");
  const rocketCountdown = sampler.querySelector("[data-rocket-countdown]");
  const rocketStatus = sampler.querySelector("[data-rocket-status]");
  const rocketLaunch = sampler.querySelector("[data-rocket-launch]");
  const rocketReset = sampler.querySelector("[data-rocket-reset]");
  let rocketTimers = [];

  function clearRocketTimers() {
    rocketTimers.forEach((timer) => window.clearTimeout(timer));
    rocketTimers = [];
  }

  function resetRocket() {
    clearRocketTimers();
    rocketStage.dataset.state = "ready";
    rocketCountdown.textContent = "Ready";
    rocketStatus.textContent = "Rocket checked. Launch when ready.";
    rocketLaunch.disabled = false;
  }

  function launchRocket() {
    clearRocketTimers();
    rocketStage.dataset.state = "countdown";
    rocketStatus.textContent = "Countdown started. Eyes on the sky!";
    rocketLaunch.disabled = true;
    const steps = ["5", "4", "3", "2", "1", "Blast off!"];
    steps.forEach((step, index) => {
      rocketTimers.push(
        window.setTimeout(() => {
          rocketCountdown.textContent = step;
          if (step === "Blast off!") {
            rocketStage.dataset.state = "flight";
            rocketStatus.textContent = "Liftoff! The rocket is climbing.";
          }
        }, index * 540),
      );
    });
    rocketTimers.push(
      window.setTimeout(() => {
        rocketStage.dataset.state = "complete";
        rocketCountdown.textContent = "Orbit";
        rocketStatus.textContent =
          "We made it to space! Ready for another launch.";
        rocketLaunch.disabled = false;
      }, 4200),
    );
  }
  rocketLaunch.addEventListener("click", launchRocket);
  rocketReset.addEventListener("click", resetRocket);

  const continentFacts = {
    "north-america": {
      marker: [178, 177],
      name: "North America",
      fact: "North America has Arctic ice, forests, deserts, mountains, farms, and warm beaches.",
      countries: ["United States", "Canada", "Mexico"],
    },
    "south-america": {
      marker: [250, 343],
      name: "South America",
      fact: "South America is home to the Amazon rainforest, the Andes Mountains, and wide grasslands.",
      countries: ["Brazil", "Argentina", "Peru"],
    },
    europe: {
      marker: [350, 178],
      name: "Europe",
      fact: "Europe has many languages and countries packed closely together, from Atlantic coasts to snowy Alps.",
      countries: ["France", "Germany", "Italy"],
    },
    africa: {
      marker: [365, 282],
      name: "Africa",
      fact: "Africa is the second-largest continent, with deserts, rainforests, savannas, and more than 50 countries.",
      countries: ["Egypt", "Kenya", "South Africa"],
    },
    asia: {
      marker: [468, 170],
      name: "Asia",
      fact: "Asia is the largest continent and includes the world's tallest mountains and many huge cities.",
      countries: ["Japan", "India", "China"],
    },
    oceania: {
      marker: [500, 375],
      name: "Oceania",
      fact: "Oceania includes Australia, New Zealand, and thousands of Pacific islands.",
      countries: ["Australia", "New Zealand", "Fiji"],
    },
  };
  const continentButtons = [...sampler.querySelectorAll("[data-continent]")];
  const continentShapes = [
    ...sampler.querySelectorAll("[data-continent-shape]"),
  ];
  const globeMarker = sampler.querySelector("[data-globe-marker]");
  const continentName = sampler.querySelector("[data-continent-name]");
  const continentFact = sampler.querySelector("[data-continent-fact]");
  const continentCountries = sampler.querySelector(
    "[data-continent-countries]",
  );

  function selectContinent(id) {
    const fact = continentFacts[id];
    continentName.textContent = fact.name;
    continentFact.textContent = fact.fact;
    continentCountries.replaceChildren(
      ...fact.countries.map((country) => {
        const chip = document.createElement("span");
        chip.textContent = country;
        return chip;
      }),
    );
    globeMarker.setAttribute("cx", String(fact.marker[0]));
    globeMarker.setAttribute("cy", String(fact.marker[1]));
    continentButtons.forEach((button) => {
      const selected = button.dataset.continent === id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    continentShapes.forEach((shape) => {
      shape.classList.toggle(
        "is-selected",
        shape.dataset.continentShape === id,
      );
    });
  }
  continentButtons.forEach((button) => {
    button.addEventListener("click", () =>
      selectContinent(button.dataset.continent),
    );
  });
  selectContinent("north-america");

  const fireScene = sampler.querySelector("[data-fire-scene]");
  const safetyButtons = [...sampler.querySelectorAll("[data-safety-choice]")];
  const safetyFeedback = sampler.querySelector("[data-safety-feedback]");
  const safetyBadge = sampler.querySelector("[data-fire-safe-badge]");
  const safetyReset = sampler.querySelector("[data-safety-reset]");

  function resetSafety() {
    fireScene.classList.remove("is-safe");
    safetyBadge.hidden = true;
    safetyFeedback.textContent =
      "Choose the move that keeps you safely away from heat.";
    safetyFeedback.className = "safety-feedback";
    safetyButtons.forEach((button) => {
      button.disabled = false;
      button.className = "";
    });
  }

  function chooseSafety(event) {
    const button = event.currentTarget;
    if (button.dataset.safetyChoice !== "grown-up") {
      button.classList.add("gentle-nudge");
      safetyFeedback.textContent =
        "Good thinking—choose the move that keeps you away from the heat.";
      safetyFeedback.className = "safety-feedback safety-feedback-gentle";
      window.setTimeout(() => button.classList.remove("gentle-nudge"), 450);
      return;
    }
    button.classList.add("safety-correct");
    fireScene.classList.add("is-safe");
    safetyBadge.hidden = false;
    safetyFeedback.textContent =
      "Safe choice! Step back, tell a grown-up, and leave the pan alone.";
    safetyFeedback.className = "safety-feedback safety-feedback-success";
    safetyButtons.forEach((choice) => {
      choice.disabled = true;
    });
  }
  safetyButtons.forEach((button) => {
    button.addEventListener("click", chooseSafety);
  });
  safetyReset.addEventListener("click", resetSafety);

  const countryFacts = {
    "united-states": [
      "United States",
      "Capital: Washington, D.C.",
      "The United States has 50 states and landscapes ranging from Arctic Alaska to tropical Hawaii.",
    ],
    canada: [
      "Canada",
      "Capital: Ottawa",
      "Canada has ten provinces, three territories, and coastlines on the Atlantic, Pacific, and Arctic oceans.",
    ],
    mexico: [
      "Mexico",
      "Capital: Mexico City",
      "Mexico includes high mountains, northern deserts, tropical rainforests, and shores on two oceans.",
    ],
    france: [
      "France",
      "Capital: Paris",
      "France stretches from Atlantic beaches and rolling farms to the high Alps beside Italy and Switzerland.",
    ],
    kenya: [
      "Kenya",
      "Capital: Nairobi",
      "Kenya has savannas, fertile highlands, the Great Rift Valley, and a coast on the Indian Ocean.",
    ],
    japan: [
      "Japan",
      "Capital: Tokyo",
      "Japan is an island country known for mountains, fast trains, busy cities, and thousands of smaller islands.",
    ],
  };
  const countryButtons = [...sampler.querySelectorAll("[data-country]")];
  const countryPins = [...sampler.querySelectorAll("[data-country-pin]")];
  const countryName = sampler.querySelector("[data-country-name]");
  const countryCapital = sampler.querySelector("[data-country-capital]");
  const countryFact = sampler.querySelector("[data-country-fact]");

  function selectCountry(id) {
    const fact = countryFacts[id];
    countryName.textContent = fact[0];
    countryCapital.textContent = fact[1];
    countryFact.textContent = fact[2];
    countryButtons.forEach((button) => {
      const selected = button.dataset.country === id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    countryPins.forEach((pin) => {
      pin.classList.toggle("is-selected", pin.dataset.countryPin === id);
    });
  }
  countryButtons.forEach((button) => {
    button.addEventListener("click", () =>
      selectCountry(button.dataset.country),
    );
  });
  selectCountry("united-states");
})();
