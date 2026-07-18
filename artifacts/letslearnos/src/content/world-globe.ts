export interface CountryRegionFact {
  name: string;
  fact: string;
}

export interface CountryFact {
  name: string;
  capital: string;
  fact: string;
  regionsLabel: string;
  regions: CountryRegionFact[];
}

export interface ContinentFact {
  id: string;
  name: string;
  markerLabel: string;
  lat: number;
  lng: number;
  color: string;
  fact: string;
  countries: CountryFact[];
}

export const continents: ContinentFact[] = [
  {
    id: "north-america",
    name: "North America",
    markerLabel: "North\nAmerica",
    lat: 43,
    lng: -102,
    color: "#35a7ff",
    fact: "North America has frozen Arctic places, huge forests, deserts, mountains, farms, and warm beaches.",
    countries: [
      {
        name: "United States",
        capital: "Washington, D.C.",
        fact: "The United States has 50 states. Georgia is known for peaches, and New Jersey is known for cranberries.",
        regionsLabel: "States",
        regions: [
          { name: "Georgia", fact: "Georgia is called the Peach State." },
          {
            name: "New Jersey",
            fact: "New Jersey grows cranberries in sandy wet bogs.",
          },
          {
            name: "California",
            fact: "California has giant redwood trees and ocean beaches.",
          },
        ],
      },
      {
        name: "Canada",
        capital: "Ottawa",
        fact: "Canada is the second biggest country in the world and has many lakes and forests.",
        regionsLabel: "Provinces",
        regions: [
          {
            name: "Ontario",
            fact: "Ontario has Toronto and the capital city, Ottawa.",
          },
          {
            name: "Quebec",
            fact: "Quebec has many French-speaking communities.",
          },
          {
            name: "British Columbia",
            fact: "British Columbia has mountains, forests, and Pacific beaches.",
          },
        ],
      },
      {
        name: "Mexico",
        capital: "Mexico City",
        fact: "Mexico has deserts, rainforests, mountains, and warm coasts.",
        regionsLabel: "States",
        regions: [
          { name: "Jalisco", fact: "Jalisco is known for mariachi music." },
          {
            name: "Yucatan",
            fact: "Yucatan has cenotes, which are natural water holes.",
          },
          {
            name: "Oaxaca",
            fact: "Oaxaca has mountains and many colorful traditions.",
          },
        ],
      },
    ],
  },
  {
    id: "south-america",
    name: "South America",
    markerLabel: "South\nAmerica",
    lat: -18,
    lng: -60,
    color: "#26c281",
    fact: "South America has the Amazon rainforest, the Andes Mountains, grasslands, and long coastlines.",
    countries: [
      {
        name: "Brazil",
        capital: "Brasilia",
        fact: "Brazil is the largest country in South America and has much of the Amazon rainforest.",
        regionsLabel: "States",
        regions: [
          {
            name: "Amazonas",
            fact: "Amazonas has huge rainforest areas and many rivers.",
          },
          {
            name: "Sao Paulo",
            fact: "Sao Paulo is a busy state with a very large city.",
          },
          { name: "Bahia", fact: "Bahia has warm beaches and colorful music." },
        ],
      },
      {
        name: "Argentina",
        capital: "Buenos Aires",
        fact: "Argentina stretches from warm northern places to chilly Patagonia in the south.",
        regionsLabel: "Provinces",
        regions: [
          {
            name: "Buenos Aires",
            fact: "Buenos Aires province surrounds Argentina's capital city area.",
          },
          { name: "Mendoza", fact: "Mendoza sits near the Andes Mountains." },
          {
            name: "Tierra del Fuego",
            fact: "Tierra del Fuego is at the very southern tip of South America.",
          },
        ],
      },
      {
        name: "Peru",
        capital: "Lima",
        fact: "Peru has Pacific beaches, tall Andes mountains, and Amazon rainforest.",
        regionsLabel: "Regions",
        regions: [
          { name: "Cusco", fact: "Cusco is near Machu Picchu in the Andes." },
          { name: "Loreto", fact: "Loreto has rainforest and river travel." },
          { name: "Lima", fact: "Lima is on the Pacific coast." },
        ],
      },
    ],
  },
  {
    id: "europe",
    name: "Europe",
    markerLabel: "Europe",
    lat: 51,
    lng: 12,
    color: "#8f7cff",
    fact: "Europe has many countries close together, with old castles, rivers, farms, mountains, and seas.",
    countries: [
      {
        name: "France",
        capital: "Paris",
        fact: "France has the Eiffel Tower, farms, mountains, and Mediterranean beaches.",
        regionsLabel: "Regions",
        regions: [
          { name: "Ile-de-France", fact: "Paris is in Ile-de-France." },
          {
            name: "Normandy",
            fact: "Normandy has green fields and sea cliffs.",
          },
          {
            name: "Provence",
            fact: "Provence is known for sunny fields and lavender.",
          },
        ],
      },
      {
        name: "Germany",
        capital: "Berlin",
        fact: "Germany has forests, rivers, busy cities, and snowy Alps in the south.",
        regionsLabel: "States",
        regions: [
          {
            name: "Bavaria",
            fact: "Bavaria has Alpine mountains and castles.",
          },
          { name: "Berlin", fact: "Berlin is both a city and a state." },
          { name: "Saxony", fact: "Saxony has old towns and river valleys." },
        ],
      },
      {
        name: "Italy",
        capital: "Rome",
        fact: "Italy is shaped like a boot and has volcanoes, islands, and ancient ruins.",
        regionsLabel: "Regions",
        regions: [
          { name: "Lazio", fact: "Rome is in Lazio." },
          {
            name: "Sicily",
            fact: "Sicily is a large island with a volcano called Mount Etna.",
          },
          { name: "Tuscany", fact: "Tuscany has rolling hills and old towns." },
        ],
      },
    ],
  },
  {
    id: "africa",
    name: "Africa",
    markerLabel: "Africa",
    lat: 3,
    lng: 21,
    color: "#ffb000",
    fact: "Africa has deserts, rainforests, savannas, tall mountains, and many different animals.",
    countries: [
      {
        name: "Egypt",
        capital: "Cairo",
        fact: "Egypt has the Nile River and ancient pyramids.",
        regionsLabel: "Governorates",
        regions: [
          {
            name: "Cairo",
            fact: "Cairo is a very large city near the Nile River.",
          },
          { name: "Giza", fact: "Giza is famous for pyramids." },
          { name: "Aswan", fact: "Aswan is farther south on the Nile." },
        ],
      },
      {
        name: "Kenya",
        capital: "Nairobi",
        fact: "Kenya has savannas where elephants, lions, and giraffes can live.",
        regionsLabel: "Counties",
        regions: [
          { name: "Nairobi", fact: "Nairobi is Kenya's capital county." },
          { name: "Mombasa", fact: "Mombasa is on the Indian Ocean coast." },
          { name: "Narok", fact: "Narok is near wide grasslands." },
        ],
      },
      {
        name: "South Africa",
        capital: "Pretoria",
        fact: "South Africa has coastlines, mountains, grasslands, and penguins near the sea.",
        regionsLabel: "Provinces",
        regions: [
          {
            name: "Western Cape",
            fact: "Western Cape has Cape Town and Table Mountain.",
          },
          { name: "Gauteng", fact: "Gauteng has big cities and many people." },
          {
            name: "KwaZulu-Natal",
            fact: "KwaZulu-Natal has warm beaches and mountains.",
          },
        ],
      },
    ],
  },
  {
    id: "asia",
    name: "Asia",
    markerLabel: "Asia",
    lat: 34,
    lng: 88,
    color: "#ff6b6b",
    fact: "Asia is the largest continent and has the highest mountains, big deserts, forests, and many islands.",
    countries: [
      {
        name: "China",
        capital: "Beijing",
        fact: "China has the Great Wall, giant cities, deserts, mountains, and pandas.",
        regionsLabel: "Provinces",
        regions: [
          {
            name: "Sichuan",
            fact: "Sichuan is known for pandas and mountains.",
          },
          { name: "Yunnan", fact: "Yunnan has many mountains and plants." },
          { name: "Guangdong", fact: "Guangdong is near the South China Sea." },
        ],
      },
      {
        name: "India",
        capital: "New Delhi",
        fact: "India has the Himalayas, deserts, farms, rivers, and warm coasts.",
        regionsLabel: "States",
        regions: [
          {
            name: "Rajasthan",
            fact: "Rajasthan has desert landscapes and forts.",
          },
          {
            name: "Kerala",
            fact: "Kerala has tropical coasts and backwaters.",
          },
          {
            name: "Himachal Pradesh",
            fact: "Himachal Pradesh is in the Himalayas.",
          },
        ],
      },
      {
        name: "Japan",
        capital: "Tokyo",
        fact: "Japan is a chain of islands with mountains, volcanoes, and cherry blossoms.",
        regionsLabel: "Prefectures",
        regions: [
          { name: "Tokyo", fact: "Tokyo is a huge city and a prefecture." },
          { name: "Hokkaido", fact: "Hokkaido is snowy in winter." },
          {
            name: "Okinawa",
            fact: "Okinawa has warm islands and coral reefs.",
          },
        ],
      },
    ],
  },
  {
    // Named Oceania, not Australia — New Zealand is grouped here and is not
    // part of the continent of Australia.
    id: "australia",
    name: "Oceania",
    markerLabel: "Oceania",
    lat: -25,
    lng: 134,
    color: "#f472b6",
    fact: "Oceania has Australia, New Zealand, and thousands of Pacific islands, with deserts, beaches, reefs, and unusual animals.",
    countries: [
      {
        name: "Australia",
        capital: "Canberra",
        fact: "Australia has kangaroos, koalas, deserts, rainforests, and the Great Barrier Reef.",
        regionsLabel: "States and territories",
        regions: [
          {
            name: "Queensland",
            fact: "Queensland is near the Great Barrier Reef.",
          },
          {
            name: "New South Wales",
            fact: "New South Wales has Sydney and many beaches.",
          },
          {
            name: "Western Australia",
            fact: "Western Australia is huge and has deserts and coasts.",
          },
        ],
      },
      {
        name: "New Zealand",
        capital: "Wellington",
        fact: "New Zealand has two main islands, volcanoes, mountains, and fjords.",
        regionsLabel: "Regions",
        regions: [
          { name: "Auckland", fact: "Auckland sits near many harbors." },
          { name: "Canterbury", fact: "Canterbury has plains and mountains." },
          {
            name: "Otago",
            fact: "Otago has lakes, hills, and old gold towns.",
          },
        ],
      },
      {
        name: "Papua New Guinea",
        capital: "Port Moresby",
        fact: "Papua New Guinea has rainforests, mountains, islands, and many languages.",
        regionsLabel: "Provinces",
        regions: [
          { name: "National Capital District", fact: "Port Moresby is here." },
          { name: "Morobe", fact: "Morobe has mountains and coastline." },
          {
            name: "East New Britain",
            fact: "East New Britain is on an island with volcanoes.",
          },
        ],
      },
    ],
  },
  {
    id: "antarctica",
    name: "Antarctica",
    markerLabel: "Antarctica",
    lat: -79,
    lng: 20,
    color: "#7dd3fc",
    fact: "Antarctica is the coldest continent. It is covered in ice, and scientists visit research stations there.",
    countries: [
      {
        name: "Antarctica",
        capital: "No capital city",
        fact: "Antarctica is not a country. Many countries work together to study it peacefully.",
        regionsLabel: "Research areas",
        regions: [
          {
            name: "McMurdo Station",
            fact: "McMurdo is a large research station near the coast.",
          },
          {
            name: "South Pole Station",
            fact: "The South Pole Station is near Earth's southern point.",
          },
          {
            name: "Antarctic Peninsula",
            fact: "The peninsula reaches toward South America.",
          },
        ],
      },
    ],
  },
];
