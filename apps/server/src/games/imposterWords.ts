/**
 * Curated category / word list for Imposter. The category is shown to everybody; the word only to the crew.
 * Words are short, well known and fairly clue-able. Keep every word unique across the whole list.
 */
export interface ImposterCategory {
  id: string;
  name: string;
  words: readonly string[];
}

export const IMPOSTER_CATEGORIES: readonly ImposterCategory[] = [
  {
    id: 'famous-movies',
    name: 'Famous Movies',
    words: ['Titanic', 'Inception', 'Jurassic Park', 'The Godfather', 'Avatar', 'Frozen', 'Gladiator', 'Shrek', 'Interstellar', 'Casablanca', 'Sholay', 'The Matrix']
  },
  {
    id: 'movie-snacks',
    name: 'Movie Snacks',
    words: ['Popcorn', 'Nachos', 'Hot Dog', 'Candy Floss', 'Soda', 'Chocolate Bar', 'Pretzel', 'Samosa', 'Ice Cream', 'Gummy Bears', 'Fries', 'Caramel Corn']
  },
  {
    id: 'cinema-genres',
    name: 'Cinema Genres',
    words: ['Horror', 'Comedy', 'Romance', 'Western', 'Thriller', 'Documentary', 'Musical', 'Animation', 'Science Fiction', 'Fantasy', 'Mystery', 'War']
  },
  {
    id: 'superheroes',
    name: 'Superheroes',
    words: ['Batman', 'Spider-Man', 'Superman', 'Wonder Woman', 'Iron Man', 'Thor', 'Hulk', 'Black Panther', 'Aquaman', 'Flash', 'Captain America', 'Wolverine']
  },
  {
    id: 'foods',
    name: 'Foods',
    words: ['Pizza', 'Burger', 'Sushi', 'Biryani', 'Pasta', 'Tacos', 'Dumplings', 'Pancakes', 'Sandwich', 'Noodles', 'Falafel', 'Curry']
  },
  {
    id: 'animals',
    name: 'Animals',
    words: ['Elephant', 'Penguin', 'Giraffe', 'Dolphin', 'Kangaroo', 'Octopus', 'Tiger', 'Panda', 'Eagle', 'Crocodile', 'Hedgehog', 'Flamingo']
  },
  {
    id: 'countries',
    name: 'Countries',
    words: ['India', 'Brazil', 'Japan', 'Egypt', 'Canada', 'Australia', 'Italy', 'Mexico', 'Norway', 'Kenya', 'Thailand', 'Argentina']
  },
  {
    id: 'sports',
    name: 'Sports',
    words: ['Cricket', 'Football', 'Tennis', 'Basketball', 'Swimming', 'Boxing', 'Badminton', 'Hockey', 'Golf', 'Archery', 'Surfing', 'Wrestling']
  },
  {
    id: 'jobs',
    name: 'Jobs',
    words: ['Doctor', 'Pilot', 'Chef', 'Teacher', 'Astronaut', 'Firefighter', 'Detective', 'Farmer', 'Architect', 'Photographer', 'Plumber', 'Magician']
  },
  {
    id: 'city-places',
    name: 'Places in a City',
    words: ['Airport', 'Library', 'Hospital', 'Stadium', 'Museum', 'Train Station', 'Shopping Mall', 'Zoo', 'Bakery', 'Fire Station', 'Park', 'Post Office']
  },
  {
    id: 'kitchen',
    name: 'Things in a Kitchen',
    words: ['Spatula', 'Blender', 'Toaster', 'Frying Pan', 'Rolling Pin', 'Whisk', 'Refrigerator', 'Kettle', 'Colander', 'Microwave', 'Ladle', 'Cutting Board']
  },
  {
    id: 'festivals',
    name: 'Festivals',
    words: ['Diwali', 'Christmas', 'Holi', 'Halloween', 'Eid', 'Thanksgiving', 'Carnival', 'New Year', 'Easter', 'Oktoberfest', 'Pongal', 'Lantern Festival']
  },
  {
    id: 'instruments',
    name: 'Musical Instruments',
    words: ['Guitar', 'Piano', 'Violin', 'Drums', 'Flute', 'Trumpet', 'Sitar', 'Harp', 'Saxophone', 'Tabla', 'Accordion', 'Ukulele']
  },
  {
    id: 'cinema-gear',
    name: 'At the Movies',
    words: ['Ticket', '3D Glasses', 'Projector', 'Clapperboard', 'Red Carpet', 'Trailer', 'Director', 'Screenplay', 'Stunt Double', 'Popcorn Bucket', 'Film Reel', 'Spotlight']
  }
];

export function allImposterWords(): string[] {
  return IMPOSTER_CATEGORIES.flatMap((c) => [...c.words]);
}
