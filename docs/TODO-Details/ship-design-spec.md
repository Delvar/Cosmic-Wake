### Create Ship Design Specification Document

[← Back to main TODO](../../TODO.md#ship-spec)

**Priority:** High (foundational for visual & mechanical consistency)  
**Status:** Not started  

**Goal:** Establish a single, data-driven spec so that cargo capacity directly drives overall ship scale, while engines, reactor, fuel, crew spaces, etc. scale proportionally and remain visually/mechanically believable. This prevents arbitrary sizes and ensures new ships (e.g. future freighters or fighters) feel part of the same universe.

**Core Scaling Rules to Define:**  
- **Cargo capacity → hull volume/mass**  
  Base ship “dry mass” + cargo mass determines total displacement. Cargo should occupy a realistic fraction of internal volume (e.g. 40-70 % for freighters, near 0 % for pure fighters).
- **Engines & thrust**  
  Engine size (visual feature points + bounding box) and max thrust scale with total ship mass (or required delta-v/acceleration). Define thrust-to-mass ratios per ship role (e.g. interceptors need high T/W, freighters lower but efficient). Include engine plume size and heat signature.
- **Reactor & power systems**  
  Reactor volume/power output scales with total energy demand (thrusters + weapons + life support + sensors). Supporting equipment (cooling, shielding) takes additional volume.
- **Fuel/propellant storage**  
  Tank size based on range, specific impulse, and burn rate. Differentiate reaction mass vs. reactor fuel.
- **Cockpit/bridge**  
  Volume and feature points for bridge. Number of crew stations (1-2 for small ships, 4-8+ for large). Visual size scales lightly with ship class.
- **Crew accommodation**  
  - Bridge crew: space per person (cramped vs. standard).  
  - Non-bridge crew (engineers, maintenance, stewards): minimum headcount based on ship volume/system complexity.  
  - Bunks/galley/quarters: volume per crew member (e.g. hot-bunking 2-4 m³ vs. individual cabins 10-20+ m³).  
  - Corridors & access ways: minimum width/volume for movement (consider zero-g vs. under thrust).  
- **Life support & provisions**  
  Food/water/storage per crew per day (or week/month). Scale with mission duration and crew size. Include recycling efficiency factor.
- **Passenger capacity (if applicable)**  
  Passenger rooms significantly larger/more comfortable than crew quarters. Define cramped vs. luxury tiers.

**Additional Factors the Spec Must Consider:**  
- **Mass budget breakdown** (hull structure, armour, systems, cargo, crew + effects). Keep total mass consistent with current `Ship` physics.
- **Power & heat management** (radiators, cooling loops — important for visual design and potential future mechanics).
- **Internal layout logic** (engine room aft, cargo bays central, crew forward; corridors, airlocks, maintenance access).
- **Role-specific multipliers** (freighter: high cargo %, low crew; interceptor: high thrust %, minimal quarters; liner: high passenger %).
- **Visual scaling rules** for Canvas rendering (feature points, bounding box, trail emitters, turret placement all derive from the same base dimensions).
- **Gameplay balance hooks** (cargo affects trade profit/handling; crew count affects maintenance cost or repair speed; fuel limits range without refuelling).
- **Extensibility** (easy to add new ship roles or tech levels that change efficiency ratios without breaking existing ships).
- **Zero-g vs. thrust considerations** (how quarters feel under acceleration; artificial gravity if ever added).
- **Maintenance & EVA access** (external hatches, repair drones, etc.).
- **Emergency systems** (escape pods, lifeboats — scale with crew/passenger count).
- **Faction flavour** (minor visual or naming differences while keeping core scaling identical).

**Next Actions:**  
1. Draft the markdown spec with tables/formulas.
2. Build a spreadsheet/table to store the raw data for each Ship type.
3. Build an interactive form that following the rules allows me to enter key values and highlight constraints, should output the required graphical dimensions that I can then use to draw the ships.
4. Document how we should use the spec when adding ships in case I forget later.
