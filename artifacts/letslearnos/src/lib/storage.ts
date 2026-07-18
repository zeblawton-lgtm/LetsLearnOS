export interface ProgressState {
  learnedPokemon: number[];
  quizScores: {
    whosThatPokemon: number;
    whatType: number;
    guessMove: number;
  };
  totalQuestionsAnswered: number;
  streak: number;
}

const DEFAULT_STATE: ProgressState = {
  learnedPokemon: [],
  quizScores: { whosThatPokemon: 0, whatType: 0, guessMove: 0 },
  totalQuestionsAnswered: 0,
  streak: 0,
};

export const getProgress = (): ProgressState => {
  try {
    const data = localStorage.getItem("letslearn_progress");
    return data ? JSON.parse(data) : DEFAULT_STATE;
  } catch (e) {
    return DEFAULT_STATE;
  }
};

export const saveProgress = (state: ProgressState) => {
  localStorage.setItem("letslearn_progress", JSON.stringify(state));
};

export const markPokemonLearned = (id: number) => {
  const state = getProgress();
  if (!state.learnedPokemon.includes(id)) {
    state.learnedPokemon.push(id);
    saveProgress(state);
  }
};

export const addQuizScore = (quizType: keyof ProgressState['quizScores'], correct: boolean) => {
  const state = getProgress();
  state.totalQuestionsAnswered++;

  if (correct) {
    state.quizScores[quizType]++;
    state.streak++;
  } else {
    state.streak = 0;
  }

  saveProgress(state);
};
