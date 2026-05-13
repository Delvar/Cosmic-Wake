# Module: Weapon

## Responsibility

The weapon module implements ship armament and projectile firing behaviour.
It defines the weapon cooldown system, fixed forward-facing guns, and auto-tracking turrets.

This module is responsible for:

- weapon cooldown and firing logic
- spawning projectiles through the star system projectile manager
- turret aiming, target selection, and lead computation
- fixed weapon firing from a ship's forward-mounted hardpoints

## Main files

- `src/weapon/weapon.js`
- `src/weapon/turret.js`
- `src/weapon/fixedWeapon.js`

## Existing patterns

- `Weapon` is the base firing primitive.
  - It tracks cooldown timing and exposes `update()`, `fire()`, and `canFire()`.
  - It uses `ProjectileManager.projectileTypes` to resolve projectile behaviour.
  - It constructs projectile velocity by adding ship velocity to firing direction.
- `Turret` provides autonomous aiming and firing control.
  - It updates only when the ship is `Flying` and turret mode is not `Disabled`.
  - It selects targets using ship-level hostility and target preferences.
  - It computes lead positions for moving targets before firing.
  - It uses scratch `Vector2D` objects extensively to avoid allocations in the update loop.
- `FixedWeapon` is a simple forward-facing mount.
  - It fires along the ship's forward angle regardless of target.
  - Its update loop is only concerned with weapon cooldown, not aim.
- Weapon firing is decoupled from projectile lifecycle.
  - The module delegates actual projectile creation to `ProjectileManager`.

## Things to avoid

- Avoid putting new projectile collision or damage logic into this module.
  - Projectile behaviour belongs in `starSystem/projectileManager.js` and `starSystem/projectile.js`.
- Avoid adding UI or input handling here.
  - Ship controls and turret mode selection are managed by pilots, jobs, or ship UI.
- Avoid bypassing `ProjectileManager.spawn()`.
  - Projectiles should be created through the manager to keep system state consistent.
- Avoid allocating new vectors inside hot turret update code.
  - Continue using the existing scratch-vector pattern.
- Avoid hardcoding ship-specific target priorities inside turret logic without clear need.
  - Turrets should remain focused on aiming and firing, not high-level target strategy.

## Tests

- There are no dedicated automated tests for the weapon module in this repository.
- If tests are added, priority cases are:
  - `Weapon` cooldown and `fire()` timing behaviour
  - `Weapon` projectile spawn parameters (position, direction, owner)
  - `Turret` target selection and lead computation
  - `FixedWeapon` world position firing and `canFire()` behaviour

## Change guidance

When editing the weapon module:

1. Keep `Weapon` as a stateless cooldown/firing primitive.
2. Keep projectile data and spawn semantics in `ProjectileManager`.
3. Preserve the `Turret` update flow: `update()` -> `selectTarget()` -> aim -> `fire()`.
4. Use the ship's `turretMode` and `state` checks before firing.
5. Keep target selection and aim logic separate from ship mission code.
6. Update this doc if the weapon/ projectile contract changes.

## Open questions

- Should `Weapon` support named projectile types instead of numeric indices?
- Would a separate `TurretAiming` helper simplify lead computation and target choice?
- Should `FixedWeapon` fire only when `ship.target` is valid, or always when ready?
- Is there a need for a shared `WeaponMount` abstraction across fixed and turret weapons?
