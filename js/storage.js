// js/storage.js

export const getStorage = (key, defaultValue) => {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.error('Error reading from localStorage', e);
        return defaultValue;
    }
};

export const setStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Error writing to localStorage', e);
    }
};

export const getProfile = () => getStorage('profile', {
    goal: '유지',
    height: '',
    weight: '',
    age: '',
    gender: '남',
    allergies: [],
    dislikes: []
});

export const saveProfile = (profile) => setStorage('profile', profile);

export const getHistory = () => getStorage('history', {}); // { 'YYYY-MM-DD': [menuId1, menuId2] }

export const addHistory = (dateStr, menuId) => {
    const history = getHistory();
    if (!history[dateStr]) {
        history[dateStr] = [];
    }
    history[dateStr].push(menuId);
    setStorage('history', history);
};

export const removeHistory = (dateStr, menuId) => {
    const history = getHistory();
    if (history[dateStr]) {
        history[dateStr] = history[dateStr].filter(id => id !== menuId);
        if (history[dateStr].length === 0) {
            delete history[dateStr];
        }
        setStorage('history', history);
    }
};

export const getBlacklist = () => getStorage('blacklist', []);

export const addBlacklist = (keyword) => {
    const list = getBlacklist();
    if (!list.includes(keyword)) {
        list.push(keyword);
        setStorage('blacklist', list);
    }
};

export const removeBlacklist = (keyword) => {
    let list = getBlacklist();
    list = list.filter(item => item !== keyword);
    setStorage('blacklist', list);
};

export const getRecentMeal = () => getStorage('recentMeal', '');
export const setRecentMeal = (meal) => setStorage('recentMeal', meal);
