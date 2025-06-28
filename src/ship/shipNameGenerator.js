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
 * Word lists and patterns for ship name generation.
 */
const nameData = {
    Civilian: {
        adjectives: [
            'Golden', 'Blue', 'Silver', 'Bright', 'Wistful', 'Noble', 'Swift', 'Lucky',
            'Radiant', 'Misty', 'Bold', 'Serene', 'Starlit', 'Gentle', 'Hopeful',
            'Cosmic', 'Lunar', 'Stellar', 'Nebulous', 'Glinting', 'Velvet', 'Tranquil',
            'Vivid', 'Celestial', 'Auroral', 'Ethereal', 'Shimmering', 'Pristine', 'Soaring'
        ],
        nouns: [
            'Star', 'Horizon', 'Comet', 'Nebula', 'Voyage', 'Dawn', 'Falcon', 'Rose',
            'Sky', 'Quest', 'Phoenix', 'Dream', 'Aurora', 'Pathfinder', 'Beacon',
            'Galaxy', 'Meteor', 'Drift', 'Venture', 'Eclipse', 'Nova', 'Orbit',
            'Wanderer', 'Zephyr', 'Crest', 'Pulsar', 'Mirage', 'Oasis', 'Trailblazer'
        ],
        names: [
            'John', 'Mary', 'James', 'Elizabeth', 'William', 'Sarah', 'Thomas', 'Emma',
            'Charles', 'Anna', 'Henry', 'Clara', 'Edward', 'Jane', 'Robert',
            'Alice', 'George', 'Lucy', 'Samuel', 'Grace', 'Oliver', 'Rose', 'Benjamin',
            'Eleanor', 'David', 'Sophia', 'Michael', 'Lily', 'Isaac'
        ],
        suffixes: ['-tek', '-nova', '-pulse', '-ara', '-ix', '-on', '-oid'],
        patterns: {
            small: [
                { weight: 0.8, fn: () => `${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.15, fn: () => `${randomChoice(nameData.Civilian.nouns)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            medium: [
                { weight: 0.35, fn: () => `${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.25, fn: () => `${randomChoice(nameData.Civilian.nouns)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.2, fn: () => `${randomChoice(nameData.Civilian.names)}'s ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.15, fn: () => `${randomChoice(nameData.Civilian.nouns)}'s ${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            large: [
                { weight: 0.35, fn: () => `${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.25, fn: () => `${randomChoice(nameData.Civilian.names)}'s ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.2, fn: () => `${randomChoice(nameData.Civilian.nouns)}'s ${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}` },
                { weight: 0.15, fn: () => `${randomChoice(nameData.Civilian.adjectives)} ${randomChoice(nameData.Civilian.nouns)}${Math.random() < 0.2 ? randomChoice(nameData.Civilian.suffixes) : ''}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ]
        }
    },
    Pirate: {
        adjectives: [
            'Bloody', 'Crimson', 'Dark', 'Savage', 'Black', 'Grim', 'Rusty', 'Wicked',
            'Fierce', 'Tattered', 'Deadly', 'Sinister', 'Vile', 'Shadow', 'Iron',
            'Feral', 'Cursed', 'Gloom', 'Vicious', 'Dread', 'Murky', 'Sable', 'Brutal',
            'Ragged', 'Foul', 'Dire', 'Gruesome', 'Noxious', 'Blighted', 'Ruthless'
        ],
        nouns: [
            'Skull', 'Dagger', 'Revenge', 'Storm', 'Serpent', 'Raider', 'Plague', 'Hawk',
            'Viper', 'Cutlass', 'Ruin', 'Ghost', 'Slaughter', 'Abyss', 'Raven',
            'Kraken', 'Scourge', 'Bane', 'Marauder', 'Fang', 'Tempest', 'Doombringer',
            'Specter', 'Corsair', 'Wraith', 'Reaper', 'Havoc', 'Nightmare', 'Venom'
        ],
        sinisterNames: [
            'Blackbeard', 'Dracula', 'Mordred', 'Vexan', 'Cain', 'Ravenna', 'Judas',
            'Lilith', 'Khan', 'Seren', 'Grendel', 'Medusa', 'Rasputin', 'Horus', 'Vlad',
            'Calico', 'Barbossa', 'Kidd', 'Drake', 'Morgan', 'Lafitte', 'Bonnet',
            'Rackham', 'Vane', 'Teach', 'Scourge', 'Malice', 'Dreadlock', 'Ironclad'
        ],
        badOutcomes: [
            'Doom', 'Ruin', 'Death', 'Torment', 'Chaos', 'Plunder', 'Misery', 'Wrath',
            'Fury', 'Darkness', 'Blight', 'Malice', 'Hell', 'Ragnarok', 'Betrayal',
            'Carnage', 'Despair', 'Annihilation', 'Oblivion', 'Peril', 'Cataclysm',
            'Vengeance', 'Horror', 'Devastation', 'Treachery', 'Agony', 'Inferno'
        ],
        patterns: {
            small: [
                { weight: 0.85, fn: () => `${randomChoice(nameData.Pirate.adjectives)} ${randomChoice(nameData.Pirate.nouns)}` },
                { weight: 0.1, fn: () => `${randomChoice(nameData.Pirate.nouns)} of ${randomChoice(nameData.Pirate.badOutcomes)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            medium: [
                { weight: 0.35, fn: () => `${randomChoice(nameData.Pirate.adjectives)} ${randomChoice(nameData.Pirate.nouns)}` },
                {
                    weight: 0.3, fn: () => {
                        const name = randomChoice(nameData.Pirate.sinisterNames);
                        return `${name}${name.endsWith('s') ? "'" : "'s"} ${randomChoice(nameData.Pirate.nouns)}`;
                    }
                },
                { weight: 0.3, fn: () => `${randomChoice(nameData.Pirate.nouns)} of ${randomChoice(nameData.Pirate.badOutcomes)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            large: [
                {
                    weight: 0.45, fn: () => {
                        const name = randomChoice(nameData.Pirate.sinisterNames);
                        return `${name}${name.endsWith('s') ? "'" : "'s"} ${randomChoice(nameData.Pirate.nouns)}`;
                    }
                },
                { weight: 0.45, fn: () => `${randomChoice(nameData.Pirate.nouns)} of ${randomChoice(nameData.Pirate.badOutcomes)}` },
                { weight: 0.1, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ]
        }
    },
    Officer: {
        adjectives: [
            'Valiant', 'Steadfast', 'Resolute', 'Stern', 'Noble', 'Vigilant', 'Stalwart',
            'Bold', 'Unyielding', 'Just', 'Swift', 'Gallant', 'True', 'Iron', 'Firm',
            'Dauntless', 'Upright', 'Stout', 'Brave', 'Regal', 'Dutiful', 'Honest',
            'Relentless', 'Sturdy', 'Trusty', 'Intrepid', 'Righteous', 'Gallant', 'Faithful'
        ],
        nouns: [
            'Sentinel', 'Guardian', 'Defender', 'Citadel', 'Fortress', 'Shield', 'Beacon',
            'Vindicator', 'Pillar', 'Bulwark', 'Sentry', 'Bastion', 'Watch', 'Lance', 'Star',
            'Rampart', 'Ward', 'Stronghold', 'Tower', 'Aegis', 'Protector', 'Paragon',
            'Vigil', 'Anchor', 'Spear', 'Haven', 'Fort', 'Command', 'Justice'
        ],
        virtues: [
            'Honor', 'Justice', 'Duty', 'Order', 'Valor', 'Strength', 'Glory', 'Courage',
            'Resolve', 'Truth', 'Vigilance', 'Liberty', 'Fortitude', 'Pride', 'Unity',
            'Loyalty', 'Integrity', 'Nobility', 'Sacrifice', 'Endurance', 'Discipline',
            'Wisdom', 'Resilience', 'Conviction', 'Freedom', 'Heroism', 'Steadfastness'
        ],
        natoAlphabet: [
            'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
            'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
            'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
            'Yankee', 'Zulu'
        ],
        patterns: {
            small: [
                { weight: 0.45, fn: ship => `${getJobName(ship.pilot?.job)} ${randomChoice(nameData.Officer.natoAlphabet)} ${randomSerialNumber()}` },
                { weight: 0.45, fn: ship => `${getJobName(ship.pilot?.job)} ${randomSerialNumber()}` },
                { weight: 0.1, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            medium: [
                { weight: 0.4, fn: () => `${randomChoice(nameData.Officer.adjectives)} ${randomChoice(nameData.Officer.nouns)}` },
                { weight: 0.4, fn: () => `${randomChoice(nameData.Officer.nouns)} of ${randomChoice(nameData.Officer.virtues)}` },
                { weight: 0.2, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            large: [
                { weight: 0.5, fn: () => `${randomChoice(nameData.Officer.nouns)} of ${randomChoice(nameData.Officer.virtues)}` },
                { weight: 0.5, fn: () => `${randomChoice(nameData.Officer.adjectives)} ${randomChoice(nameData.Officer.nouns)}` }
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
        adjectives: [
            'Brave', 'Swift', 'Bold', 'Lucky', 'Free', 'Stellar', 'Bright', 'Daring',
            'Valiant', 'Heroic', 'Cosmic', 'Wander', 'Starborn', 'Fearless', 'Epic',
            'Gallant', 'Radiant', 'Noble', 'Intrepid', 'Vivid', 'Spirited', 'Grand',
            'Adventurous', 'Luminous', 'Dazzling', 'Valorous', 'Dynamic', 'Exalted'
        ],
        nouns: [
            'Voyager', 'Quest', 'Star', 'Pathfinder', 'Explorer', 'Horizon', 'Nova',
            'Destiny', 'Pioneer', 'Venture', 'Odyssey', 'Comet', 'Galaxy', 'Drift', 'Dream',
            'Trailblazer', 'Beacon', 'Journey', 'Starlight', 'Vanguard', 'Aurora', 'Crusader',
            'Nomad', 'Eclipse', 'Zephyr', 'Paragon', 'Seeker', 'Harbinger', 'Legacy'
        ],
        suffixes: ['-tek', '-nova', '-pulse', '-ara', '-ix', '-on', '-oid'],
        patterns: {
            small: [
                { weight: 0.8, fn: () => `${randomChoice(nameData.Player.adjectives)} ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.15, fn: () => `${randomChoice(nameData.Player.nouns)} ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            medium: [
                { weight: 0.4, fn: () => `${randomChoice(nameData.Player.adjectives)} ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.35, fn: () => `${randomChoice(nameData.Player.nouns)} ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.2, fn: () => `${randomChoice(nameData.Player.nouns)} of ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ],
            large: [
                { weight: 0.4, fn: () => `${randomChoice(nameData.Player.adjectives)} ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.35, fn: () => `${randomChoice(nameData.Player.nouns)} of ${randomChoice(nameData.Player.nouns)}` },
                { weight: 0.2, fn: () => `${randomChoice(nameData.Player.adjectives)} ${randomChoice(nameData.Player.nouns)}${Math.random() < 0.2 ? randomChoice(nameData.Player.suffixes) : ''}` },
                { weight: 0.05, fn: () => `${randomChoice(nameData.fun.prefixes)} ${randomChoice(nameData.fun.roots)}${Math.random() < 0.2 ? randomChoice(nameData.fun.suffixes) : ''}${Math.random() < 0.2 ? ' ' + randomSmallNumber() : ''}` }
            ]
        }
    },
    fun: {
        prefixes: [
            'Disco', 'Funky', 'Wobbly', 'Gizmo', 'Bloop', 'Snaccident', 'Mega', 'Zany',
            'Nifty', 'Whacky', 'Zippy', 'Bonkers', 'Kooky', 'Nutty', 'Silly', 'Giddy',
            'Bouncy', 'Jolly', 'Wacko', 'Zesty'
        ],
        roots: [
            'tickler', 'wobbler', 'floof', 'noodle', 'blasterpants', 'zoomzoom', 'chugger',
            'sparkler', 'bopper', 'whizz', 'fluffel', 'gizmo', 'doodler', 'snoozle',
            'waffler', 'popper', 'zapper', 'bloopster', 'fizzler', 'twirler'
        ],
        suffixes: [
            '-inator', '-zoid', '-omatic', '-erino', '-splosion', '-licious', '-pants',
            '-tastic', '-oodle', '-rama', '-palooza', '-mageddon', '-zap', '-boom'
        ]
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
    } else if (ship.radius < 200) {
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