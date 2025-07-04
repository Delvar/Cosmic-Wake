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
    NeutralAdjective: ['Bold', 'Bright', 'Calm', 'Charming', 'Clear', 'Cosmic',
        'Gallant', 'Gleaming', 'Glinting', 'Lunar', 'Pristine', 'Radiant', 'Serene',
        'Silent', 'Soaring', 'Steady', 'Stellar', 'Swift', 'Tranquil', 'Vivid'],
    PositiveAdjective: ['Auroral', 'Blessed', 'Celestial', 'Dreamy', 'Enchanted',
        'Ethereal', 'Fabled', 'Fated', 'Gallant', 'Golden', 'Hopeful', 'Humble',
        'Jolly', 'Joyful', 'Lone', 'Lucky', 'Merry', 'Misty', 'Noble', 'Radiant',
        'Serendipitous', 'Shimmering', 'Starbound', 'Wandering', 'Whimsical', 'Wistful'],
    NegativeAdjective: ['Black', 'Bloody', 'Crimson', 'Cursed', 'Dark', 'Deadly',
        'Dread', 'Feral', 'Fierce', 'Gloom', 'Grim', 'Iron', 'Rusty', 'Savage',
        'Shadow', 'Sinister', 'Tattered', 'Vicious', 'Vile', 'Wicked'],
    NeutralNoun: ['Beacon', 'Comet', 'Crest', 'Dawn', 'Drift', 'Eclipse', 'Falcon',
        'Galaxy', 'Horizon', 'Journey', 'Legend', 'Meteor', 'Mirage', 'Nebula',
        'Nexus', 'Nova', 'Oasis', 'Orbit', 'Path', 'Pulsar', 'Saga', 'Sky', 'Star',
        'Tide', 'Trailblazer', 'Venture', 'Voyage', 'Wave', 'Zephyr'],
    PositiveNoun: ['Aurora', 'Beacon', 'Dawn', 'Destiny', 'Dream', 'Dreams', 'End',
        'Faith', 'Folly', 'Glory', 'Harmony', 'Hero', 'Hope', 'Joy', 'Life',
        'Pathfinder', 'Peace', 'Phoenix', 'Quest', 'Road', 'Rose', 'Spark', 'Starlight',
        'Stars', 'Vision', 'Vow', 'Wish'],
    NegativeNoun: ['Abyss', 'Bane', 'Cutlass', 'Dagger', 'Fang', 'Ghost', 'Hawk',
        'Kraken', 'Marauder', 'Plague', 'Raider', 'Raven', 'Revenge', 'Ruin', 'Scourge',
        'Serpent', 'Skull', 'Slaughter', 'Storm', 'Viper'],
    NeutralNames: ['Alice', 'Amelia', 'Anna', 'Benjamin', 'Charles', 'Charlotte',
        'Clara', 'Daniel', 'David', 'Edward', 'Eleanor', 'Elizabeth', 'Emma', 'Evelyn',
        'George', 'Grace', 'Henry', 'Isaac', 'Isabelle', 'James', 'Jane', 'John',
        'Joseph', 'Leo', 'Lily', 'Lucy', 'Margaret', 'Mary', 'Matilda', 'Michael',
        'Nathan', 'Oliver', 'Robert', 'Rose', 'Samuel', 'Sarah', 'Sophia', 'Theodore',
        'Thomas', 'Violet', 'William'],
    NegativeNames: ['Barbossa', 'Blackbeard', 'Bonnet', 'Cain', 'Calico', 'Dracula',
        'Drake', 'Grendel', 'Horus', 'Judas', 'Khan', 'Kidd', 'Lafitte', 'Lilith',
        'Medusa', 'Mordred', 'Morgan', 'Rackham', 'Rasputin', 'Ravenna', 'Seren',
        'Teach', 'Vane', 'Vexan', 'Vlad'],
    PersonifiedNouns: ['Admiral', 'Aunt', 'Bard', 'Baron', 'Baroness"', 'Brother',
        'Caliph', 'Captain', 'Chairman', 'Chairwoman', 'Champion', 'Chieftain', 'Commodore',
        'Companion', 'Count', 'Countess', 'Cousin', 'Director', 'Dreamer', 'Drifter',
        'Duchess', 'Duke', 'Earl', 'Emperor', 'Empress', 'Explorer', 'Fellow', 'Friend',
        'General', 'Hajji', 'Hetman', 'Jarl', 'King', 'Knight', 'Lady', 'Lord', 'Madam',
        'Major', 'Marquis', 'Master', 'Maverick', 'Mistress', 'Nomad', 'Overseer', 'Pasha',
        'Pilgrim', 'Poet', 'President', 'Prime Minister', 'Prince', 'Princess', 'Queen',
        'Rabbi', 'Rogue', 'Sage', 'Saint', 'Scout', 'Seeker', 'Sergeant', 'Sir', 'Sister',
        'Sovereign', 'Starfarer', 'Steward', 'Sultan', 'Traveler', 'Tsar', 'Uncle',
        'Vagabond', 'Viscount', 'Visionary', 'Wanderer'],
    Places: ['Alpha Centauri', 'Andromeda', 'Betelgeuse', 'Centaurus', 'Earth', 'Eridanus',
        'Europa', 'Jupiter', 'Luna', 'Mars', 'Nebula', 'Orion', 'Pleiades', 'Polaris',
        'Proxima', 'Rigel', 'Saturn', 'Sirius', 'Sol', 'Titan', 'Vega', 'Venus'],
    Suffixes: ['-ara', '-ix', '-nova', '-oid', '-on', '-pulse', '-tek'],
    FunPrefixes: ['Bloop', 'Bonkers', 'Bouncy', 'Disco', 'Funky', 'Giddy', 'Gizmo',
        'Jolly', 'Kooky', 'Mega', 'Nifty', 'Nutty', 'Silly', 'Snaccident', 'Wacko',
        'Whacky', 'Wobbly', 'Zany', 'Zesty', 'Zippy'],
    FunRoots: ['Blasterpants', 'Bloopster', 'Bopper', 'Chugger', 'Doodler', 'Fizzler',
        'Floof', 'Fluffel', 'Gizmo', 'Noodle', 'Popper', 'Snoozle', 'Sparkler', 'Tickler',
        'Twirler', 'Waffler', 'Whizz', 'Wobbler', 'Zapper', 'Zoomzoom'],
    FunSuffixes: ['-boom', '-erino', '-inator', '-licious', '-mageddon', '-omatic', '-oodle',
        '-palooza', '-pants', '-rama', '-splosion', '-tastic', '-zap', '-zoid'],
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
                { weight: 1.0, fn: () => `${NeutralNames()} ${The()}${PositiveAdjective()} Of ${Places()}` }, // e.g., "David The Celestial Of Mars"
                // Standard poetic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Noble Drift"
                // Simple single noun
                { weight: 1.0, fn: () => `The ${NeutralNoun()}` }, // e.g., "The Journey"
                // Quirky personified name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "The Jolly Maverick"
                // Simple adjective-noun
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "Lucky Nexus"
                // Noun combination
                { weight: 1.0, fn: () => `${NeutralNoun()} ${NeutralNoun()}` }, // e.g., "Star Journey"
                // Personal adjective-name
                { weight: 1.0, fn: () => `${PositiveAdjective()} ${NeutralNames()}` }, // e.g., "Misty Jane"
                // Poetic noun-personified
                { weight: 1.0, fn: () => `${NeutralNoun()} ${PersonifiedNouns()}` }, // e.g., "Nebula Wanderer"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            medium: [
                // Standard poetic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Noble Drift"
                // Noun combination
                { weight: 1.0, fn: () => `${NeutralNoun()} ${NeutralNoun()}` }, // e.g., "Star Journey"
                // Possessive name
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveNoun()}` }, // e.g., "Benjamin's Glory"
                // Place-based possessive
                { weight: 1.0, fn: () => `${The()}${Places()}'s ${PositiveNoun()}` }, // e.g., "The Earth’s Hope"
                // Complex possessive
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()}'s ${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Star’s Golden Voyage"
                // Poetic complex name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()} Of ${PositiveNoun()}` }, // e.g., "The Fated Mirage Of Folly"
                // Narrative personified
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "William's Radiant Nomad"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            large: [
                // Epic place-based
                { weight: 1.0, fn: () => `${The()}${PositiveNoun()} Of ${Places()}` }, // e.g., "The Road Of Titan"
                // Place-based possessive
                { weight: 1.0, fn: () => `${Places()}'s ${PositiveNoun()}` }, // e.g., "Andromeda's Stars"
                // Possessive name
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveNoun()}` }, // e.g., "Mary's Dream"
                // Poetic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Misty Star-pulse"
                // Complex possessive
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()}'s ${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Horizon's Humble Eclipse"
                // Narrative personified
                { weight: 1.0, fn: () => `${NeutralPossessiveNames()} ${PositiveAdjective()} ${PersonifiedNouns()}` }, // e.g., "Joseph's Hopeful Queen"
                // Poetic complex name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()} Of ${PositiveNoun()}` }, // e.g., "The Merry Tide Of Rose"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    },
    Pirate: {
        patterns: {
            small: [
                // Standard menacing name
                { weight: 1.0, fn: () => `${The()}${NegativeAdjective()} ${NegativeNoun()}` }, // e.g., "The Dark Plague"
                // Outcome-based name
                { weight: 1.0, fn: () => `${The()}${NegativeNoun()} Of ${PositiveNoun()}` }, // e.g., "The Scourge Of Joy"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            medium: [
                // Standard menacing name
                { weight: 1.0, fn: () => `${The()}${NegativeAdjective()} ${NegativeNoun()}` }, // e.g., "The Dark Plague"
                // Outcome-based name
                { weight: 1.0, fn: () => `${The()}${NegativeNoun()} Of ${PositiveNoun()}` }, // e.g., "The Scourge Of Joy"
                // Possessive name
                { weight: 1.0, fn: () => `${NegativePossessiveNames()} ${NegativeNoun()}` }, // e.g., "Rasputin's Storm"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            large: [
                // Outcome-based name
                { weight: 1.0, fn: () => `${The()}${NegativeNoun()} Of ${PositiveNoun()}` }, // e.g., "The Scourge Of Joy"
                // Possessive name
                { weight: 1.0, fn: () => `${NegativePossessiveNames()} ${NegativeNoun()}` }, // e.g., "Rasputin's Storm"
                // Menacing with suffix
                { weight: 1.0, fn: () => `${The()}${NegativeAdjective()} ${NegativeNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Crimson Storm-pulse"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    },
    Officer: {
        patterns: {
            small: [
                // Job-based with NATO alphabet
                { weight: 1.0, fn: ship => `${JobName(ship)} ${NatoAlphabet()} ${randomSerialNumber()}` }, // e.g., "Escort Sierra 9560"
                // Job-based with number
                { weight: 1.0, fn: ship => `${JobName(ship)} ${randomSerialNumber()}` }, // e.g., "Escort 5113"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            medium: [
                // Standard virtuous name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Golden Nova"
                // Virtue-based name
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()} Of ${PositiveNoun()}` }, // e.g., "The Eclipse Of Peace"
                // Job-based with NATO alphabet
                { weight: 1.0, fn: ship => `${JobName(ship)} ${NatoAlphabet()} ${randomSerialNumber()}` }, // e.g., "Escort Zulu 7441"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            large: [
                // Standard virtuous name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}` }, // e.g., "The Golden Nova"
                // Virtue-based name
                { weight: 1.0, fn: () => `${The()}${NeutralNoun()} of ${PositiveNoun()}` }, // e.g., "The Eclipse Of Peace"
                // Poetic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${NeutralNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Radiant Venture-tek"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ]
        }
    },
    Player: {
        patterns: {
            small: [
                // Standard heroic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "The Starbound Harmony"
                // Noun combination
                { weight: 1.0, fn: () => `${PositiveNoun()} ${PositiveNoun()}` }, // e.g., "Starlight Joy"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            medium: [
                // Standard heroic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "The Starbound Harmony
                // Noun combination
                { weight: 1.0, fn: () => `${PositiveNoun()} ${PositiveNoun()}` }, // e.g., "Starlight Joy"
                // Outcome-based name
                { weight: 1.0, fn: () => `${The()}${PositiveNoun()} Of ${PositiveNoun()}` }, // e.g., "The Beacon Of Faith"
                // Fun quirky name
                { weight: 1.0, fn: () => `${The()}${FunPrefixes()} ${FunRoots()}${Math.random() < 0.2 ? FunSuffixes() : ''}${Math.random() < 0.2 ? ' ' + Number() : ''}` } // e.g., "The Disco Noodle 42"
            ],
            large: [
                // Standard heroic name
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PositiveNoun()}` }, // e.g., "The Starbound Harmony
                // Outcome-based name
                { weight: 1.0, fn: () => `${The()}${PositiveNoun()} Of ${PositiveNoun()}` }, // e.g., "The Beacon Of Faith"
                // Heroic with suffix
                { weight: 1.0, fn: () => `${The()}${PositiveAdjective()} ${PositiveNoun()}${Math.random() < 0.3 ? Suffixes() : ''}` }, // e.g., "The Radiant End-tek"
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