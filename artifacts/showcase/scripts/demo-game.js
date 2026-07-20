(() => {
  const game = document.querySelector("[data-demo-game]");
  if (!game) return;

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
  const reset = game.querySelector("[data-reset]");
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

  function advance() {
    if (questionIndex === questions.length - 1) {
      questionIndex = 0;
      starCount = 0;
    } else {
      questionIndex += 1;
    }
    renderQuestion();
  }

  function restart() {
    questionIndex = 0;
    starCount = 0;
    renderQuestion();
  }

  answers.forEach((button) => button.addEventListener("click", chooseAnswer));
  next.addEventListener("click", advance);
  reset.addEventListener("click", restart);
  renderQuestion();
})();
