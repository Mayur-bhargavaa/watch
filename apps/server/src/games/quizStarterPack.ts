import type { QuizQuestionInput } from '@synccinema/common';

const mc = (text: string, options: string[], correctIndex: number, timeLimitSec: 10 | 20 | 30, points: 100 | 200 | 300, note = ''): QuizQuestionInput => ({
  type: 'MULTIPLE_CHOICE',
  text,
  options,
  correctIndex,
  timeLimitSec,
  points,
  note
});

const buzzer = (text: string, points: 100 | 200 | 300, note: string): QuizQuestionInput => ({
  type: 'BUZZER',
  text,
  options: [],
  correctIndex: -1,
  timeLimitSec: 45,
  points,
  note
});

/** "Movie Night starter pack": 12 ready questions (Hollywood, Bollywood and TV trivia; mostly multiple choice, a few buzzers). */
export const MOVIE_NIGHT_STARTER_PACK: readonly QuizQuestionInput[] = [
  mc('Which film became the first non-English-language movie to win the Oscar for Best Picture?', ['1917', 'Parasite', 'Joker', 'Roma'], 1, 20, 100, 'Parasite (2020)'),
  mc('Who directed the dream-heist thriller Inception?', ['Steven Spielberg', 'James Cameron', 'Christopher Nolan', 'Ridley Scott'], 2, 20, 100),
  mc('Which Bollywood film gave us the villain line "Mogambo khush hua"?', ['Sholay', 'Mr. India', 'Don', 'Karz'], 1, 20, 100),
  mc('Which TV series is set in the Seven Kingdoms and fights over the Iron Throne?', ['Game of Thrones', 'Vikings', 'The Witcher', 'Merlin'], 0, 10, 100),
  mc('Who played Jack Dawson in Titanic (1997)?', ['Brad Pitt', 'Matt Damon', 'Tom Cruise', 'Leonardo DiCaprio'], 3, 10, 100),
  mc('In which Bollywood film does a student called Rancho challenge the education system?', ['PK', 'Dangal', '3 Idiots', 'Lagaan'], 2, 20, 200),
  mc('In the sitcom Friends, what is the surname of the siblings Ross and Monica?', ['Bing', 'Geller', 'Tribbiani', 'Buffay'], 1, 20, 200),
  mc('Which film shows Thanos snapping his fingers to erase half of all life?', ['Justice League', 'Black Panther', 'Avengers: Infinity War', 'Thor: Ragnarok'], 2, 20, 200),
  mc('Which actor is famously nicknamed "King Khan" of Bollywood?', ['Salman Khan', 'Aamir Khan', 'Saif Ali Khan', 'Shah Rukh Khan'], 3, 10, 100),
  buzzer('Name the 2008 Aamir Khan film about a man with short-term memory loss who tattoos clues on his body.', 200, 'Ghajini (2008)'),
  buzzer('Name the Pixar film in which a clownfish crosses the ocean to find his lost son.', 100, 'Finding Nemo'),
  buzzer('In Breaking Bad, what is the first name of the chemistry teacher who becomes Heisenberg?', 200, 'Walter (Walter White)')
];
