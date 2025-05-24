// /src/ship/shield.js

import { Vector2D } from '/src/core/vector2d.js';
import { TWO_PI, remapClamp } from '/src/core/utils.js';

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
    constructor(maxStrength = 100, rechargeRate = 20, restartDelay = 3, rapidRechargeRate = 50, rapidRechargeDuration = 3) {
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
        this.restartTime = 0;
        /** @type {number} Time remaining for rapid recharge effect in seconds.*/
        this.rapidRechargeEffectTime = 0;
        /** @type {number} Time remaining for hit pulse effect in seconds. */
        this.pulseEffectTime = 0;
        /** @type {number} Maximum duration of hit pulse effect in seconds. */
        this.pulseEffectMaxTime = 0.5;
        /** @type {number} Time remaining for collapse effect in seconds. */
        this.collapseEffectTime = 0;
        /** @type {number} Maximum duration of collapse effect in seconds. */
        this.collapseEffectMaxTime = 0.25;
        /** @type {number} Time since shield restart for restart effect in seconds. */
        this.restartEffectTime = 0;
        /** @type {number} Time since shield restart for restart effect in seconds. */
        this.restartEffectMaxTime = 0.25;
        /** @type {Vector2D} Relative offset from ship position for hit pulse hot spot. */
        this.hitPosition = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for world-space hit point calculation. */
        this._scratchWorldHit = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for shield center in screen coordinates. */
        this._scratchShieldCenter = new Vector2D(0, 0);
        /** @type {Vector2D} Temporary vector for shield hit point in screen coordinates. */
        this._scratchShieldHit = new Vector2D(0, 0);
    }

    /**
     * Updates the shield's state, handling recharge, restart, and effect timings.
     * @param {number} deltaTime - Time step in seconds.
     * @param {number} currentTime - Current game time in seconds.
     */
    update(deltaTime, currentTime) {
        // Update effect timers
        if (this.pulseEffectTime > 0) {
            this.pulseEffectTime = Math.max(this.pulseEffectTime - deltaTime, 0);
        }
        if (this.collapseEffectTime > 0) {
            this.collapseEffectTime = Math.max(this.collapseEffectTime - deltaTime, 0);
        }
        if (this.restartEffectTime > 0) {
            this.restartEffectTime = Math.max(this.restartEffectTime - deltaTime, 0);
        }
        if (this.rapidRechargeEffectTime > 0) {
            this.rapidRechargeEffectTime = Math.max(this.rapidRechargeEffectTime - deltaTime, 0);
        }

        // Update shield strength and status
        if (this.isActive) {
            const isRapidRecharge = this.rapidRechargeEffectTime > 0;
            const rate = isRapidRecharge ? this.rapidRechargeRate : this.rechargeRate;
            this.strength = Math.min(this.strength + rate * deltaTime, this.maxStrength);
        } else if (currentTime >= this.restartTime) {
            // Restart shields
            this.isActive = true;
            this.strength = 0;
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
        if (this.strength <= 0) {
            // Shields collapse
            this.isActive = false;
            this.restartTime = currentTime + this.restartDelay;
            this.collapseEffectTime = this.collapseEffectMaxTime;
            const excessDamage = -this.strength;
            this.strength = 0;
            return excessDamage;
        }

        // Trigger hit pulse effect
        this.pulseEffectTime = this.pulseEffectMaxTime;
        this.hitPosition.set(hitPosition).subtractInPlace(shipPosition);
        return 0;
    }

    /**
     * Draws the shield effects (hit pulse, collapse, or restart) if active.
     * @param {CanvasRenderingContext2D} ctx - Canvas context.
     * @param {Object} camera - Camera for world-to-screen transform.
     * @param {Vector2D} shipPosition - Ship's current world-space position.
     * @param {number} shipRadius - Ship's radius in world units.
     */
    draw(ctx, camera, shipPosition, shipRadius) {
        // Validate inputs
        if (!isFinite(shipPosition.x) || !isFinite(shipPosition.y) ||
            !isFinite(this.hitPosition.x) || !isFinite(this.hitPosition.y) ||
            !isFinite(shipRadius)) {
            // console.warn('Invalid shield draw inputs:', {
            //   shipPosition: [shipPosition.x, shipPosition.y],
            //   hitPosition: [this.hitPosition.x, this.hitPosition.y],
            //   shipRadius
            // });
            return;
        }

        camera.worldToScreen(shipPosition, this._scratchShieldCenter);
        let shieldRadius = camera.worldToSize(shipRadius);
        if (!isFinite(shieldRadius) || shieldRadius <= 0) {
            // console.warn('Invalid shield radius:', shieldRadius);
            return;
        }
        let alphaScale = 1;

        //apply collapseEffect and restartEffect scales to and alpha
        if (this.collapseEffectTime > 0) {
            // Draw collapse effect expanding out to 2 and fade out
            alphaScale = remapClamp(this.collapseEffectTime, 0, this.collapseEffectMaxTime, 0, 1);//0.8 * (this.collapseEffectTime / this.collapseEffectMaxTime);
            shieldRadius = shieldRadius * 2 * (1 - alphaScale);
            const alpha = alphaScale;
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0, `rgba(100, 150, 255, ${alpha})`);
            gradient.addColorStop(1, `rgba(0, 50, 150, ${0.2 * alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.restartEffectTime > 0) {
            // Draw restart effect expanding from 0 and fade in
            alphaScale = 1 - remapClamp(this.restartEffectTime, 0, this.restartEffectMaxTime, 0, 1);//0.8 * (this.collapseEffectTime / this.collapseEffectMaxTime);
            shieldRadius = shieldRadius * (alphaScale);
            const alpha = alphaScale * 0.5;
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0, `rgba(0, 50, 150, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100, 150, 255, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.rapidRechargeEffectTime > 0) {
            // Draw restart effect expanding from 0 and fade in
            alphaScale = 1;
            const alpha = remapClamp(this.rapidRechargeEffectTime, 0, this.rapidRechargeDuration, 0, 0.5);
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0, `rgba(0, 50, 150, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100, 150, 255, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        } else if (this.isActive && this.pulseEffectTime > 0) {
            // when hit draw a faint outline of the shield
            alphaScale = 1;
            const alpha = remapClamp(this.pulseEffectTime, 0, this.pulseEffectMaxTime, 0, 0.5);
            const gradient = ctx.createRadialGradient(
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, 0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0, `rgba(0, 50, 150, ${0.2 * alpha})`);
            gradient.addColorStop(1, `rgba(100, 150, 255, ${alpha})`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw hit pulse effect (inward-moving hot spot)
        if (this.isActive && this.pulseEffectTime > 0) {
            const alpha = this.pulseEffectTime / this.pulseEffectMaxTime;
            this._scratchWorldHit.set(this.hitPosition).multiplyInPlace(alpha).addInPlace(shipPosition);
            camera.worldToScreen(this._scratchWorldHit, this._scratchShieldHit);

            if (!isFinite(this._scratchShieldCenter.x) || !isFinite(this._scratchShieldCenter.y) ||
                !isFinite(this._scratchShieldHit.x) || !isFinite(this._scratchShieldHit.y)) {
                // console.warn('Invalid shield screen coordinates:', {
                //   shieldCenter: [this._scratchShieldCenter.x, this._scratchShieldCenter.y],
                //   shieldHit: [this._scratchShieldHit.x, this._scratchShieldHit.y]
                // });
                return;
            }

            const gradient = ctx.createRadialGradient(
                this._scratchShieldHit.x, this._scratchShieldHit.y, 0,
                this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius
            );
            gradient.addColorStop(0, `rgba(100, 150, 255, ${1 * alpha * alphaScale})`);
            gradient.addColorStop(0.5, `rgba(100, 150, 255, 0.0)`);

            ctx.beginPath();
            ctx.arc(this._scratchShieldCenter.x, this._scratchShieldCenter.y, shieldRadius, 0, TWO_PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }
}