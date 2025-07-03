// /src/ship/shipNameGenerator.js

import { AiPilot } from "/src/pilot/aiPilot.js";
import { Ship } from "/src/ship/ship.js";

/**
 * Ship name generator module.
 * Generates a name for a ship based on its faction, job, and size (radius).
 */

/**
 * Utility function to randomly select an item from an array.
 * @param {Array} array - The array to choose from.
 * @returns {*} A random element from the array.
 */
function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Utility function to generate a random serial number (100–9999).
 * @returns {number} A random number between 100 and 9999.
 */
function randomSerialNumber() {
    return Math.floor(Math.random() * 9900) + 100;
}

/**
 * Utility function to generate a random small number (1–99).
 * @returns {number} A random number between 1 and 99.
 */
function randomSmallNumber() {
    return Math.floor(Math.random() * 99) + 1;
}

/**
 * Maps job instances to string representations for naming.
 * @param {Object|null} job - The job instance (e.g., EscortJob).
 * @returns {string} The job name or fallback.
 */
function getJobName(job) {
    if (!job) return 'Ship';
    const jobClass = job.constructor.name;
    const jobMap = {
        'EscortJob': 'Escort',
        'MinerJob': 'Miner',
        'OfficerJob': 'Patrol',
        'PirateJob': 'Raider',
        'WandererJob': 'Freighter'
    };
    return jobMap[jobClass] || 'Ship';
}

/**
 * Word Lists
 */
const wordLists = {
    NeutralAdjective: [
        'Swift', 'Bright', 'Bold', 'Serene', 'Vivid', 'Tranquil', 'Glinting', 'Soaring',
        'Lunar', 'Stellar', 'Cosmic', 'Pristine', 'Radiant', 'Charming', 'Gallant',
        'Clear', 'Silent', 'Steady', 'Calm', 'Gleaming'
    ],
    PositiveAdjective: [
        'Golden', 'Wistful', 'Noble', 'Lucky', 'Hopeful', 'Misty', 'Celestial', 'Auroral',
        'Ethereal', 'Shimmering', 'Humble', 'Jolly', 'Fated', 'Whimsical', 'Dreamy', 'Merry',
        'Enchanted', 'Lone', 'Fabled', 'Wandering', 'Starbound', 'Gallant', 'Blessed', 'Radiant',
        'Joyful', 'Serendipitous'
    ],
    NegativeAdjective: [
        'Bloody', 'Crimson', 'Dark', 'Savage', 'Black', 'Grim', 'Rusty', 'Wicked',
        'Fierce', 'Tattered', 'Deadly', 'Sinister', 'Vile', 'Shadow', 'Iron',
        'Feral', 'Cursed', 'Gloom', 'Vicious', 'Dread'
    ],
    NeutralNoun: [
        'Star', 'Horizon', 'Comet', 'Nebula', 'Voyage', 'Dawn', 'Falcon', 'Sky',
        'Orbit', 'Galaxy', 'Meteor', 'Drift', 'Venture', 'Eclipse', 'Nova', 'Crest',
        'Pulsar', 'Mirage', 'Oasis', 'Trailblazer', 'Zephyr', 'Journey', 'Saga', 'Legend',
        'Beacon', 'Path', 'Wave', 'Tide', 'Nexus'
    ],
    PositiveNoun: [
        'Rose', 'Quest', 'Phoenix', 'Dream', 'Aurora', 'Pathfinder', 'Beacon', 'Hope',
        'Folly', 'Hero', 'Road', 'Life', 'End', 'Starlight', 'Destiny', 'Wish', 'Vow',
        'Spark', 'Glory', 'Faith', 'Joy', 'Vision', 'Peace', 'Harmony', 'Dawn', 'Dreams',
        'Stars'
    ],
    NegativeNoun: [
        'Skull', 'Dagger', 'Revenge', 'Storm', 'Serpent', 'Raider', 'Plague', 'Hawk',
        'Viper', 'Cutlass', 'Ruin', 'Ghost', 'Slaughter', 'Abyss', 'Raven', 'Kraken',
        'Scourge', 'Bane', 'Marauder', 'Fang'
    ],
    NeutralNames: [
        'John', 'Mary', 'James', 'Elizabeth', 'William', 'Sarah', 'Thomas', 'Emma',
        'Charles', 'Anna', 'Henry', 'Clara', 'Edward', 'Jane', 'Robert', 'Alice',
        'George', 'Lucy', 'Samuel', 'Grace', 'Oliver', 'Rose', 'Benjamin', 'Eleanor',
        'David', 'Sophia', 'Michael', 'Lily', 'Isaac', 'Amelia', 'Joseph', 'Charlotte',
        'Daniel', 'Margaret', 'Evelyn', 'Theodore', 'Violet', 'Nathan', 'Isabelle', 'Leo',
        'Matilda'
    ],
    NegativeNames: [
        'Blackbeard', 'Dracula', 'Mordred', 'Vexan', 'Cain', 'Ravenna', 'Judas', 'Lilith',
        'Khan', 'Seren', 'Grendel', 'Medusa', 'Rasputin', 'Horus', 'Vlad', 'Calico',
        'Barbossa', 'Kidd', 'Drake', 'Morgan', 'Lafitte', 'Bonnet', 'Rackham', 'Vane',
        'Teach'
    ],
    PersonifiedNouns: [
        'Fellow', 'Lady', 'Rogue', 'Wanderer', 'Companion', 'Nomad', 'Friend', 'Pilgrim',
        'Traveler', 'Seeker', 'Dreamer', 'Bard', 'Vagabond', 'Maverick', 'Poet', 'Sage',
        'Scout', 'Drifter', 'Visionary', 'Explorer', 'Knight', 'Starfarer'
    ],
    Places: [
        'Earth', 'Mars', 'Venus', 'Luna', 'Jupiter', 'Saturn', 'Nebula', 'Sol',
        'Alpha Centauri', 'Sirius', 'Proxima', 'Vega', 'Andromeda', 'Europa', 'Titan',
        'Orion', 'Pleiades', 'Betelgeuse', 'Rigel', 'Polaris', 'Eridanus', 'Centaurus'
    ],
    Suffixes: ['-tek', '-nova', '-pulse', '-ara', '-ix', '-on', '-oid'],
    FunPrefixes: [
        'Disco', 'Funky', 'Wobbly', 'Gizmo', 'Bloop', 'Snaccident', 'Mega', 'Zany',
        'Nifty', 'Whacky', 'Zippy', 'Bonkers', 'Kooky', 'Nutty', 'Silly', 'Giddy',
        'Bouncy', 'Jolly', 'Wacko', 'Zesty'
    ],
    FunRoots: [
        'Tickler', 'Wobbler', 'Floof', 'Noodle', 'Blasterpants', 'Zoomzoom', 'Chugger',
        'Sparkler', 'Bopper', 'Whizz', 'Fluffel', 'Gizmo', 'Doodler', 'Snoozle',
        'Waffler', 'Popper', 'Zapper', 'Bloopster', 'Fizzler', 'Twirler'
    ],
    FunSuffixes: [
        '-inator', '-zoid', '-omatic', '-erino', '-splosion', '-licious', '-pants',
        '-tastic', '-oodle', '-rama', '-palooza', '-mageddon', '-zap', '-boom'
    ],
    NatoAlphabet: [
        'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
        'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
        'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
        'Yankee', 'Zulu'
    ]
};

/**
 * Helper functions for template-based name generation.
 */
function The() { return Math.random() < 0.75 ? 'The ' : ''; }
function NeutralAdjective() { return randomChoice(wordLists.NeutralAdjective); }
function PositiveAdjective() { return randomChoice(wordLists.PositiveAdjective); }
function NegativeAdjective() { return randomChoice(wordLists.NegativeAdjective); }
function NeutralNoun() { return randomChoice(wordLists.NeutralNoun); }
function PositiveNoun() { return randomChoice(wordLists.PositiveNoun); }
function NegativeNoun() { return randomChoice(wordLists.NegativeNoun); }
function NeutralNames() { return randomChoice(wordLists.NeutralNames); } // Plain names, e.g., "Henry"
function NeutralPossessiveNames() {
    const name = randomChoice(wordLists.NeutralNames);
    return `${name}${name.endsWith('s') ? "'" : "'s"}`; // e.g., "James’" or "Mary’s"
}
function NegativePossessiveNames() {
    const name = randomChoice(wordLists.NegativeNames);
    return `${name}${name.endsWith('s') ? "'" : "'s"}`; // e.g., "Blackbeard’s" or "Dracula’s"
}
function PersonifiedNouns() { return randomChoice(wordLists.PersonifiedNouns); }
function Places() { return randomChoice(wordLists.Places); }
function Suffixes() { return randomChoice(wordLists.Suffixes); }
function FunPrefixes() { return randomChoice(wordLists.FunPrefixes); }
function FunRoots() { return randomChoice(wordLists.FunRoots); }
function FunSuffixes() { return randomChoice(wordLists.FunSuffixes); }
function Number() { return randomSmallNumber(); }
function NatoAlphabet() { return randomChoice(wordLists.NatoAlphabet); }
function JobName(ship) { return getJobName(ship.pilot?.job); }

/**
 * Patterns for ship name generation.
 */
const nameData = {
    Civilian: {
        patterns: {
            small: [
                // Humorous grandiose name for small ships
                { weight: 1.0, fn: () => `${NeutralNames()} ${The()}${PositiveAdjective()} Of ${Places()}` }, // e.g., "Alice The Hero Of Mars"
                // Standard poetic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Golden Sky"
                // Simple single noun
                { weight: 1.0, fn: () => `The ${NeutralNoun()}` }, // e.g., "The End"
                // Quirky personified name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "The Jolly Fellow"
                // Simple adjective-noun
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "Swift Horizon"
                // Noun combination
                { weight: 1.0, fn: () => `${NeutralNoun()} ${NeutralNoun()}` }, // e.g., "Nova Drift"
                // Personal adjective-name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNames()}` }, // e.g., "Humble Henry"
                // Poetic noun-personified
                { weight: 1.0, fn: () => `${NeutralNoun()} ${PersonifiedNouns()}` }, // e.g., "Star Wanderer"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            medium: [
                // Standard poetic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Misty Horizon"
                // Noun combination
                { weight: 1.0, fn: () => `${NeutralNoun()} ${NeutralNoun()}` }, // e.g., "Nova Drift"
                // Possessive name
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveNoun()}` }, // e.g., "Jane’s Folly"
                // Place-based possessive
                { weight: 1.0, fn: () => `${The()}${Places()}'s ${PositiveNoun()}` }, // e.g., "The Earth’s Hope"
                // Complex possessive
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()}'s ${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Star’s Golden Voyage"
                // Poetic complex name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()} Of ${PositiveNoun()}` }, // e.g., "The Misty Road Of Life"
                // Narrative personified
                { weight: 1.0, fn: () => `${The()}${NeutralPossessiveNames()} ${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "The John’s Jolly Fellow"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "Funky Floofinator"
            ],
            large: [
                // Epic place-based
                { weight: 1.0, fn: () => `${PositiveNoun()} Of ${Places()}` }, // e.g., "Hero Of Mars"
                // Place-based possessive
                { weight: 1.0, fn: () => `${The()}${Places()}'s ${PositiveNoun()}` }, // e.g., "The Mars’ Dawn"
                // Possessive name
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveNoun()}` }, // e.g., "Humble Henry"
                // Poetic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Bright Comet-tek"
                // Complex possessive
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()}'s ${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Star’s Golden Voyage"
                // Narrative personified
                { weight: 1.0, fn: () => `${The()}${NeutralPossessiveNames()} ${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "The Mary’s Wistful Wanderer"
                // Poetic complex name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()} Of ${PositiveNoun()}` }, // e.g., "The Misty Road Of Life"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    },
    Pirate: {
        patterns: {
            small: [
                // Standard menacing name
                { weight: 1.0, fn: () => `${NegativeAdjective()} ${NegativeNoun()}` }, // e.g., "Bloody Skull"
                // Outcome-based name
                { weight: 1.0, fn: () => `${NegativeNoun()} of ${PositiveNoun()}` }, // e.g., "Storm of Ruin"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Wobbly Bloopster"
            ],
            medium: [
                // Standard menacing name
                { weight: 1.0, fn: () => `${NegativeAdjective()} ${NegativeNoun()}` }, // e.g., "Grim Dagger"
                // Possessive name
                { weight: 1.0, fn: () => `${NegativePossessiveNames()} ${NegativeNoun()}` }, // e.g., "Blackbeard’s Viper"
                // Outcome-based name
                { weight: 1.0, fn: () => `${NegativeNoun()} of ${PositiveNoun()}` }, // e.g., "Raven of Doom"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "Funky Zoomzoom 23"
            ],
            large: [
                // Possessive name
                { weight: 1.0, fn: () => `${NegativePossessiveNames()} ${NegativeNoun()}` }, // e.g., "Dracula’s Ruin"
                // Outcome-based name
                { weight: 1.0, fn: () => `${NegativeNoun()} of ${PositiveNoun()}` }, // e.g., "Kraken of Vengeance"
                // Menacing with suffix
                { weight: 1.0, fn: () => `${The()}${NegativeAdjective()} ${NegativeNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Sinister Abyss-tek"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    },
    Officer: {
        patterns: {
            small: [
                // Job-based with NATO alphabet
                { weight: 1.0, fn: ship => `${JobName(ship)} ${NatoAlphabet()} ${randomSerialNumber()}` }, // e.g., "Patrol Alpha 123"
                // Job-based with number
                { weight: 1.0, fn: ship => `${JobName(ship)} ${randomSerialNumber()}` }, // e.g., "Escort 456"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Zany Sparkler"
            ],
            medium: [
                // Standard virtuous name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "Noble Sentinel"
                // Virtue-based name
                { weight: 1.0, fn: () => `${NeutralNoun()} of ${PositiveNoun()}` }, // e.g., "Guardian of Honor"
                // Job-based with NATO alphabet
                { weight: 1.0, fn: ship => `${JobName(ship)} ${NatoAlphabet()} ${randomSerialNumber()}` }, // e.g., "Patrol Bravo 789"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "Kooky Gizmo 17"
            ],
            large: [
                // Virtue-based name
                { weight: 1.0, fn: () => `${NeutralNoun()} of ${PositiveNoun()}` }, // e.g., "Citadel of Justice"
                // Standard virtuous name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "Valiant Fortress"
                // Poetic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Steadfast Shield-tek"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        },
        prefixes: {
            'Escort': 'L-',
            'Miner': 'M-',
            'Patrol': 'UNNC ',
            'Raider': 'F-',
            'Freighter': 'SS '
        }
    },
    Player: {
        patterns: {
            small: [
                // Standard heroic name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "Brave Voyager"
                // Noun combination
                { weight: 1.0, fn: () => `${PositiveNoun()} ${PositiveNoun()}` }, // e.g., "Star Quest"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Zany Bloopster"
            ],
            medium: [
                // Standard heroic name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "Daring Explorer"
                // Noun combination
                { weight: 1.0, fn: () => `${PositiveNoun()} ${PositiveNoun()}` }, // e.g., "Nova Destiny"
                // Outcome-based name
                { weight: 1.0, fn: () => `${PositiveNoun()} of ${PositiveNoun()}` }, // e.g., "Quest of Glory"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "Funky Zoomzoom 23"
            ],
            large: [
                // Outcome-based name
                { weight: 1.0, fn: () => `${PositiveNoun()} of ${PositiveNoun()}` }, // e.g., "Destiny of Hope"
                // Standard heroic name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "Valiant Odyssey"
                // Heroic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PositiveNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Radiant Star-tek"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    }
};

/**
 * Generates a name for a ship based on its faction, job, and size (radius).
 * @param {Ship} ship - The ship object with faction, pilot, and radius properties.
 * @returns {string} The generated ship name.
 * @throws {Error} If the ship or faction is invalid.
 */
export function generateShipName(ship) {
    if (!ship || !ship.faction || typeof ship.faction.getName !== 'function') {
        throw new Error('Invalid ship or faction');
    }

    const factionName = ship.faction.getName();
    const data = nameData[factionName] || nameData.Civilian; // Default to Civilian for unrecognized factions
    const jobName = ship.pilot instanceof AiPilot ? getJobName(ship.pilot?.job) : 'Ship';

    // Determine ship size based on radius
    let sizeCategory;
    if (ship.radius < 50) {
        sizeCategory = 'small';
    } else if (ship.radius < 100) {
        sizeCategory = 'medium';
    } else {
        sizeCategory = 'large';
    }

    // Select a pattern based on size and weights
    const patterns = data.patterns[sizeCategory];
    const totalWeight = patterns.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPattern;
    for (const pattern of patterns) {
        random -= pattern.weight;
        if (random <= 0) {
            selectedPattern = pattern.fn;
            break;
        }
    }

    // Generate the base name
    let name = selectedPattern(ship);

    // Add prefix for Officer faction based on job (for medium/large ships)
    if (factionName === 'Officer' && sizeCategory !== 'small' && data.prefixes[jobName]) {
        name = data.prefixes[jobName] + name;
    }

    console.log(name);
    return name;
}

/**
 * Generates a random ship name for testing purposes by simulating a ship with a random faction, job, and size.
 * @returns {string} A randomly generated ship name.
 */
export function generateRandomShipName() {
    // List of possible factions
    const factions = ['Civilian', 'Pirate', 'Officer', 'Player'];

    // List of possible jobs (null simulates no job)
    const jobs = [null, 'EscortJob', 'MinerJob', 'OfficerJob', 'PirateJob', 'WandererJob'];

    // Mock Faction class
    class MockFaction {
        constructor(name) {
            this.name = name;
        }
        getName() {
            return this.name;
        }
    }

    // Mock AiPilot class
    class MockAiPilot {
        constructor(job) {
            this.job = job ? { constructor: { name: job } } : null;
        }
    }

    // Create a mock ship
    const ship = {
        faction: new MockFaction(randomChoice(factions)),
        pilot: randomChoice(jobs) ? new MockAiPilot(randomChoice(jobs)) : null,
        radius: Math.random() * 300 // Random radius (0–300 to cover small, medium, large)
    };

    // Use existing generateShipName function
    return generateShipName(ship);
}