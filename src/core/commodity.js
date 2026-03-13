// /src/core/commodity.js

/**
 * Commodity system for Cosmic Wake.
 * This file defines the types and data for all tradable commodities in the game.
 * All prices are measured per metric tonne, with Water as the baseline at 1.0.
 */

import { lerp } from '/src/core/utils.js';

export const CommodityType = {
    WATER: 'water',
    METALLIC_ORES: 'metallicOres',
    REFINED_METALS: 'refinedMetals',
    CONSTRUCTION_MATERIALS: 'constructionMaterials',
    PLASTIC: 'plastic',
    FOOD: 'food',
    CLOTHING: 'clothing',
    EQUIPMENT: 'equipment',
    MEDICAL: 'medical',
    INDUSTRIAL: 'industrial',
    ELECTRONICS: 'electronics',
    LUXURY_GOODS: 'luxuryGoods',
    ANTIMATTER: 'antimatter'
};

export const Commodities = {
    [CommodityType.WATER]: {
        name: 'Water',
        primarySources: ['Asteroid belts', 'Europa', 'Mars'],
        standardPrice: 1.0,
        minPrice: 0.5,
        maxPrice: 2.5
    },
    [CommodityType.METALLIC_ORES]: {
        name: 'Metallic Ores',
        primarySources: ['Asteroid belts', 'Mars'],
        standardPrice: 0.4,
        minPrice: 0.2,
        maxPrice: 0.7
    },
    [CommodityType.REFINED_METALS]: {
        name: 'Refined Metals',
        primarySources: ['Processed asteroid and Mars ores'],
        standardPrice: 1.2,
        minPrice: 0.8,
        maxPrice: 1.8
    },
    [CommodityType.CONSTRUCTION_MATERIALS]: {
        name: 'Construction Materials',
        primarySources: ['Asteroid processing', 'Factories'],
        standardPrice: 1.5,
        minPrice: 1.0,
        maxPrice: 2.2
    },
    [CommodityType.PLASTIC]: {
        name: 'Plastic',
        primarySources: ['Venus', 'Colonies'],
        standardPrice: 1.5,
        minPrice: 0.8,
        maxPrice: 2.5
    },
    [CommodityType.FOOD]: {
        name: 'Food',
        primarySources: ['Terraformed planets', 'Hydroponics'],
        standardPrice: 2.5,
        minPrice: 1.0,
        maxPrice: 4.5
    },
    [CommodityType.CLOTHING]: {
        name: 'Clothing',
        primarySources: ['Hope\'s Landing', 'Earth'],
        standardPrice: 4.0,
        minPrice: 2.5,
        maxPrice: 6.5
    },
    [CommodityType.EQUIPMENT]: {
        name: 'Equipment',
        primarySources: ['Asteroid docks', 'Stations'],
        standardPrice: 7.0,
        minPrice: 4.0,
        maxPrice: 11.0
    },
    [CommodityType.MEDICAL]: {
        name: 'Medical',
        primarySources: ['Elysara', 'Eridani Shadow'],
        standardPrice: 12.0,
        minPrice: 8.0,
        maxPrice: 20.0
    },
    [CommodityType.INDUSTRIAL]: {
        name: 'Industrial',
        primarySources: ['Nexus Triad factories'],
        standardPrice: 4.5,
        minPrice: 2.5,
        maxPrice: 7.0
    },
    [CommodityType.ELECTRONICS]: {
        name: 'Electronics',
        primarySources: ['Alpha Centauri', 'Sol'],
        standardPrice: 10.0,
        minPrice: 6.0,
        maxPrice: 15.0
    },
    [CommodityType.LUXURY_GOODS]: {
        name: 'Luxury Goods',
        primarySources: ['Verdant Reach', 'Venus'],
        standardPrice: 25.0,
        minPrice: 15.0,
        maxPrice: 40.0
    },
    [CommodityType.ANTIMATTER]: {
        name: 'Antimatter',
        primarySources: ['Nebulae'],
        standardPrice: 400.0,
        minPrice: 200.0,
        maxPrice: 800.0
    }
};

/**
 * Get the current price of a commodity based on a normalized variation range
 * @param {string} commodityType - Key from CommodityType enum
 * @param {number} priceVariation - Normalized variation from 0.0 to 1.0 (0.5 = standard price, 0.0 = min price, 1.0 = max price)
 * @returns {number|null} Price per metric tonne or null if commodity not found
 */
export function getCommodityPrice(commodityType, priceVariation = 0.5) {
    const commodity = Commodities[commodityType];
    if (!commodity) return null;

    if (priceVariation === 0.5) {
        return commodity.standardPrice;
    } else if (priceVariation > 0.5) {
        // Interpolate between standard and max
        const factor = (priceVariation - 0.5) * 2; // 0 to 1 as variation goes 0.5 to 1.0
        return lerp(commodity.standardPrice, commodity.maxPrice, factor);
    } else {
        // Interpolate between min and standard
        const factor = priceVariation / 0.5; // 0 to 1 as variation goes 0.0 to 0.5
        return lerp(commodity.minPrice, commodity.standardPrice, factor);
    }
}
