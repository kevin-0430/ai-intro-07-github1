// js/recommendation.js
import { menus } from './data.js?v=2';
import { getProfile, getHistory, getBlacklist, getRecentMeal } from './storage.js';

// Calculate target calories
export const getTargetCalories = () => {
    const p = getProfile();
    if (!p.height || !p.weight || !p.age) return 700; // default average meal

    // Mifflin-St Jeor Equation
    let bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age;
    bmr += (p.gender === '남') ? +5 : -161;

    // Assuming light activity
    let dailyCal = bmr * 1.375;

    if (p.goal === '다이어트') dailyCal -= 500;
    if (p.goal === '근성장') dailyCal += 300;

    // Per meal (assuming 3 meals a day)
    return Math.round(dailyCal / 3);
};

const AVOID_MAP = {
    '생선': {
        allergens: [],
        keywords: ['갈치', '고등어', '동태', '조기', '굴비', '연어', '참치', '장어', '스시', '사시미', '회', '추어', '아구', '아귀']
    },
    '고기': {
        allergens: ['돼지고기', '소고기', '닭고기'],
        keywords: ['고기', '삼겹살', '갈비', '불고기', '제육', '돈카츠', '치킨', '닭', '스테이크', '폭립', '베이컨', '소시지', '햄']
    },
    '육류': {
        allergens: ['돼지고기', '소고기', '닭고기'],
        keywords: ['고기', '삼겹살', '갈비', '불고기', '제육', '돈카츠', '치킨', '닭', '스테이크', '폭립', '베이컨', '소시지', '햄']
    },
    '밀가루': {
        allergens: ['밀'],
        keywords: ['밀가루', '면', '우동', '라멘', '파스타', '피자', '빵', '칼국수', '수제비', '국수', '만두', '소룡포', '딤섬']
    },
    '조개': {
        allergens: [],
        keywords: ['조개', '굴', '홍합', '바지락', '전복', '소라', '조개탕', '봉골레']
    },
    '새우': {
        allergens: [],
        keywords: ['새우', '쉬림프', '깐쇼새우', '크림새우', '칠리새우', '멘보샤']
    },
    '갑각류': {
        allergens: [],
        keywords: ['새우', '게', '꽃게', '랍스터', '대게', '킹크랩', '쉬림프']
    },
    '닭': {
        allergens: ['닭고기'],
        keywords: ['닭', '치킨', '삼계탕', '유린기', '깐풍기']
    },
    '돼지': {
        allergens: ['돼지고기'],
        keywords: ['돼지', '돈카츠', '삼겹살', '제육', '족발', '보쌈', '탕수육']
    },
    '소': {
        allergens: ['소고기'],
        keywords: ['소고기', '한우', '스테이크', '규동', '설렁탕', '곰탕', '육개장']
    }
};

export const getRecommendations = (selectedCategory = null) => {
    const profile = getProfile();
    const history = getHistory();
    const blacklist = getBlacklist();
    const recentMeal = getRecentMeal();
    const targetCal = getTargetCalories();

    // 1. Filter phase
    let candidates = menus.filter(menu => {
        // Exclude specific category if selected
        if (selectedCategory && menu.category !== selectedCategory) return false;

        // Exclude 100% recent meal
        if (recentMeal && menu.name.includes(recentMeal)) return false;

        // Exclude blacklist
        for (let b of blacklist) {
            if (menu.name.includes(b)) return false;
        }

        // Exclude allergies & dislikes
        const userAvoids = [...profile.allergies, ...profile.dislikes];
        for (let avoid of userAvoids) {
            const avoidTrimmed = avoid.trim();
            if (!avoidTrimmed) continue;

            // Direct match on name (substring) or allergen (exact)
            if (menu.name.includes(avoidTrimmed) || (menu.allergies && menu.allergies.includes(avoidTrimmed))) {
                return false;
            }

            // Expand match via AVOID_MAP (synonyms & keyword mapping)
            const mapKeys = Object.keys(AVOID_MAP);
            for (let key of mapKeys) {
                if (avoidTrimmed.includes(key) || key.includes(avoidTrimmed)) {
                    const mapping = AVOID_MAP[key];
                    if (menu.allergies && mapping.allergens && menu.allergies.some(a => mapping.allergens.includes(a))) {
                        return false;
                    }
                    if (mapping.keywords && mapping.keywords.some(k => menu.name.includes(k))) {
                        return false;
                    }
                }
            }
        }

        return true;
    });

    // Extract traits of recent meal
    let recentTraits = [];
    if (recentMeal) {
        const recentMenuItem = menus.find(m => m.name.includes(recentMeal.trim()) || recentMeal.trim().includes(m.name));
        if (recentMenuItem && recentMenuItem.traits) {
            recentTraits = recentMenuItem.traits.filter(t => t !== '해당 X');
        }
    }

    // 2. Weighting phase (History)
    // Reduce probability based on how recent it was eaten (in past 7 days)
    const today = new Date();
    
    let weightedCandidates = candidates.map(menu => {
        let weight = 100;
        
        // Calorie optimization (closer to target cal = higher weight)
        const calDiff = Math.abs(menu.cal - targetCal);
        if (calDiff < 100) weight += 20;
        else if (calDiff > 300) weight -= 20;

        // History penalty
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            if (history[dateStr] && history[dateStr].includes(menu.id)) {
                // Heavier penalty for very recent
                const penalty = 80 - (i * 10); // Today: 80, Yesterday: 70...
                weight -= Math.max(0, penalty);
            }
        }

        // Smart trait continuous avoidance penalty
        if (recentTraits.length > 0 && menu.traits) {
            const sharedTraits = menu.traits.filter(t => recentTraits.includes(t));
            if (sharedTraits.length > 0) {
                // Reduces weight to 10% for items sharing traits with the recent meal
                weight = weight * 0.1;
            }
        }

        return { ...menu, weight: Math.max(1, Math.round(weight)) }; // minimum weight 1
    });

    // 3. Selection
    const selectedMenus = [];
    while (selectedMenus.length < 3 && weightedCandidates.length > 0) {
        // Random selection based on weight
        const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = Math.random() * totalWeight;
        
        for (let i = 0; i < weightedCandidates.length; i++) {
            randomNum -= weightedCandidates[i].weight;
            if (randomNum <= 0) {
                selectedMenus.push(weightedCandidates[i]);
                weightedCandidates.splice(i, 1); // remove selected
                break;
            }
        }
    }

    return selectedMenus;
};
