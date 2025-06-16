// /src/ship/shield.js

import { Vector2D } from '/src/core/vector2d.js';
import { TWO_PI, remapClamp } from '/src/core/utils.js';
import { Camera } from '/src/camera/camera.js';

/**
 * Manages a ship's energy shield, handling damage absorption, recharge, collapse/restart, and visual effects.
 */
export class Shield {
    /**
     * Creates a new Shield instance.
     * @param {number} [maxStrength=100] - Maximum shield strength.
     * @param {number} [rechargeRate=20] - Strength restored per second when active.
     * @param {number} [restartDelay=3] - Seconds after collapse before shields restart.
     * @param {number} [rapidRechargeRate=50] - Faster recharge rate post-restart.
     * @param {number} [rapidRechargeDuration=1] - Duration of rapid recharge in seconds.
     */
    constructor(maxStrength = 100.0, rechargeRate = 20.0, restartDelay = 3.0, rapidRechargeRate = 50.0, rapidRechargeDuration = 3.0) {
        /** @type {number} Current shield strength (0 to maxStrength). */
        this.strength = maxStrength;
        /** @type {number} Maximum shield strength. */
        this.maxStrength = maxStrength;
        /** @type {number} Strength restored per second when active. */
        this.rechargeRate = rechargeRate;
        /** @type {number} Seconds after collapse before shields restart. */
        this.restartDelay = restartDelay;
        /** @type {number} Faster recharge rate post-restart. */
        this.rapidRechargeRate = rapidRechargeRate;
        /** @type {number} Duration of rapid recharge in seconds. */
        this.rapidRechargeDuration = rapidRechargeDuration;
        /** @type {boolean} Whether shields are functional (false during collapse/restart). */
        this.isActive = true;
        /** @type {number} Timestamp (in seconds) when shields are scheduled to restart. */
        this.restartTime = 0.0;
        /** @type {number} Time remaining for rapid recharge effect in seconds.*/
        this.rapidRechargeEffectTime = 0.0;
        /** @type {number} Time remaining for hit pulse effect in seconds. */
        this.pulseEffectTime = 0.0;
        /** @type {number} Maximum duration of hit pulse effect in seconds. */
        this.pulseEffectMaxTime = 0.5;
        /** @type {number} Time remaining for collapse effect in seconds. */
        this.collapseEffectTime = 0.0;
        /** @type {number} Maximum duration of collapse effect in seconds. */
        this.collapseEffectMaxTime = 0.25;
        /** @type {number} Time since shield restart for restart effect in seconds. */
        this.restartEffectTime = 0.0;
        /** @type {number} Time since shield restart for restart effect in seconds. */
        this.restartEffectMaxTime = 0.25;
        /** @type {Vector2D} Relative offset from ship position for hit pulse hot spot. */
        this.hitPosition = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Temporary vector for world-space hit point calculation. */
        this._scratchWorldHit = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Temporary vector for shield center in screen coordinates. */
        this._scratchShieldCenter = new Vector2D(0.0, 0.0);
        /** @type {Vector2D} Temporary vector for shield hit point in screen coordinates. */
        this._scratchShieldHit = new Vector2D(0.0, 0.0);

        if (new.target === Shield) Object.seal(this);
    }

    /**
     * Updates the shield's state, handling recharge, restart, and effect timings.
     * @param {number} deltaTime - Time step in seconds.
     * @param {number} currentTime - Current game time in seconds.
     */
    update(deltaTime, currentTime) {
        // Update effect timers
        if (this.pulseEffectTime > 0.0) {
            this.pulseEffectTime = Math.max(this.pulseEffectTime - deltaTime, 0.0);
        }
        if (this.collapseEffectTime > 0.0) {
            this.collapseEffectTime = Math.max(this.collapseEffectTime - deltaTime, 0.0);
        }
        if (this.restartEffectTime > 0.0) {
            this.restartEffectTime = Math.max(this.restartEffectTime - deltaTime, 0.0);
        }
        if (this.rapidRechargeEffectTime > 0.0) {
            this.rapidRechargeEffectTime = Math.max(this.rapidRechargeEffectTime - deltaTime, 0.0);
        }

        // Update shield strength and status
        if (this.isActive) {
            const isRapidRecharge = this.rapidRechargeEffectTime > 0.0;
            const rate = isRapidRecharge ? this.rapidRechargeRate : this.rechargeRate;
            this.strength = Math.min(this.strength + rate * deltaTime, this.maxStrength);
        } else if (this.restartTime == null) {
            this.strength = 0.0;
        } else if (currentTime >= this.restartTime) {
            // Restart shields
            this.isActive = true;
            this.strength = 0.0;
            this.rapidRechargeEffectTime = this.rapidRechargeDuration;
            this.restartEffectTime = this.restartEffectMaxTime;
        }
    }

    /**
     * Applies damage to the shield, returning excess damage if collapsed.
     * Triggers a visual pulse effect if damage is absorbed, or collapse effect if shields fail.
     * @param {number} damage - Amount of damage to apply.
     * @param {Vector2D} hitPosition - World-space position of the hit.
     * @param {Vector2D} shipPosition - Ship's current world-space position.
     * @param {number} currentTime - Current game time in seconds.
     * @returns {number} Excess damage not absorbed by the shield.
     */
    takeDamage(damage, hitPosition, shipPosition, currentTime) {
        if (!this.isActive) {
            return damage; // Shields down, pass all damage through
        }

        this.strength -= damage;
        if (this.strength <= 0.0) {
            // Shields collapse
            this.isActive = false;
            this.restartTime = currentTime + this.restartDelay;
            this.collapseEffectTime = this.collapseEffectMaxTime;
            const excessDamage = -this.strength;
            this.strength = 0.0;
            return excessDamage;
        }

        // Trigger hit pulse effect
        this.pulseEffectTime = this.pulseEffectMaxTime;
        this.hitPosition.set(hitPosition).subtractInPlace(shipPosition);
        return 0.0;
    }

    /**
     * Draws the shield effects (hit pulse, collapse, or restart) if active.
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Camera} camera - Camera for world-to-screen transform.
     * @param {Vector2D} shipPosition - Ship's current world-space position.
     * @param {number} shipRadius - Ship's radius in world units.
     */
    draw(ctx, camera, shipPosition, shipRadius) {
        // Validate inputs
        if (!isFinite(shipPosition.x) || !isFinite(shipPosition.y) ||
            !isFinite(this.hitPosition.x) || !isFinite(this.hitPosition.y) ||
            !isFinite(shipRadius)) {
            return;
        }

        camera.worldToScreen(shipPosition, this._scratchShieldCenter);
        let shieldRadius = camera.worldToSize(shipRadius);
        if (!isFinite(shieldRadius) || shieldRadius <= 0.0) {
            // console.warn('Invalid shield radius:', shieldRadius);
            return;
        }
        let alphaScale = 1.0;

        //apply collapseEffect and restartEffect scales to and alpha
        if (this.collapseEffectTime > 0.0) {
            // Draw collapse effect expanding out to 2 and fade out
            alphaScale = remapClamp(this.collapseEffectTime, 0.0, this.collapseEffectMaxTime, 0.0, 1.0);//0.8 * (this.collapseEffectTime / this.collapseEffectMaxTime);
            shieldRadius = shieldRadius * 2 * (1 - alphaScale);
            const alpha = alphaScale;
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0.0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0.0, `rgba(100,  150.0,  255.0, ${alpha})`);
            gradient.addColorStop(1, `rgba(0.0,  50.0,  150.0, ${0.2 * alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0.0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.restartEffectTime > 0.0) {
            // Draw restart effect expanding from 0.0 and fade in
            alphaScale = 1 - remapClamp(this.restartEffectTime, 0.0, this.restartEffectMaxTime, 0.0, 1.0);//0.8 * (this.collapseEffectTime / this.collapseEffectMaxTime);
            shieldRadius = shieldRadius * (alphaScale);
            const alpha = alphaScale * 0.5;
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0.0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0.0, `rgba(0.0,  50.0,  150.0, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100,  150.0,  255.0, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0.0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.rapidRechargeEffectTime > 0.0) {
            // Draw restart effect expanding from 0.0 and fade in
            alphaScale = 1.0;
            const alpha = remapClamp(this.rapidRechargeEffectTime, 0.0, this.rapidRechargeDuration, 0.0, 0.5);
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0.0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0.0, `rgba(0.0,  50.0,  150.0, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100,  150.0,  255.0, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0.0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.isActive && this.pulseEffectTime > 0.0) {
            // when hit draw a faint outline of the shield
            alphaScale = 1.0;
            const alpha = remapClamp(this.pulseEffectTime, 0.0, this.pulseEffectMaxTime, 0.0, 0.5);
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0.0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0.0, `rgba(0.0,  50.0,  150.0, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100,  150.0,  255.0, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0.0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw hit pulse effect (inward-moving hot spot)
        if (this.isActive && this.pulseEffectTime > 0.0) {
            const alpha = this.pulseEffectTime / this.pulseEffectMaxTime;
            this._scratchWorldHit.set(this.hitPosition).multiplyInPlace(alpha).addInPlace(shipPosition);
            camera.worldToScreen(this._scratchWorldHit, this._scratchShieldHit);

            if (!isFinite(this._scratchShieldCenter.x) || !isFinite(this._scratchShieldCenter.y) ||
                !isFinite(this._scratchShieldHit.x) || !isFinite(this._scratchShieldHit.y)) {
                return;
            }

            const gradient = ctx.createRadialGradient(
                this._scratchShieldHit.x, this._scratchShieldHit.y, 0.0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0.0, `rgba(100,  150.0,  255.0, ${1 * alpha * alphaScale})`);
            gradient.addColorStop(0.5, `rgba(100,  150.0,  255.0, 0.0)`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0.0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }
}