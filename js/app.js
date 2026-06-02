// js/app.js
import { menus, categories } from './data.js?v=2';
import { 
    getProfile, saveProfile, 
    getHistory, addHistory, removeHistory,
    getBlacklist, addBlacklist, removeBlacklist,
    getRecentMeal, setRecentMeal 
} from './storage.js';
import { getRecommendations, getTargetCalories } from './recommendation.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Navigation ---
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    const btnHome = document.getElementById('nav-home');

    // Sidebar toggle logic
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn && sidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    const switchView = (targetId) => {
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        navBtns.forEach(btn => {
            if(btn.dataset.target === targetId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        
        // Refresh specific view data
        if(targetId === 'view-allergies' || targetId === 'view-health') loadProfile();
        if(targetId === 'view-history') renderCalendar();
        if(targetId === 'view-blacklist') renderBlacklist();
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.target));
    });

    btnHome.addEventListener('click', () => {
        selectedCategory = null;
        categoryCards.forEach(c => c.classList.remove('selected'));
        switchView('view-home');
        document.getElementById('recent-meal-input').value = getRecentMeal();
    });

    // --- Home View ---
    const categoryCards = document.querySelectorAll('.category-card');
    let selectedCategory = null;

    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            categoryCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedCategory = card.dataset.category;
        });
    });

    document.getElementById('recent-meal-input').value = getRecentMeal();
    document.getElementById('recent-meal-input').addEventListener('change', (e) => {
        setRecentMeal(e.target.value);
    });

    const triggerRecommendation = (cat) => {
        setRecentMeal(document.getElementById('recent-meal-input').value);
        const results = getRecommendations(cat);
        renderRecommendations(results);
        switchView('view-recommendation');
    };

    document.getElementById('btn-next').addEventListener('click', () => {
        triggerRecommendation(selectedCategory);
    });

    document.getElementById('btn-skip').addEventListener('click', () => {
        selectedCategory = null;
        categoryCards.forEach(c => c.classList.remove('selected'));
        triggerRecommendation(null); // Random category internally handled by engine
    });

    // --- Recommendation View ---
    const renderRecommendations = (recs) => {
        const container = document.getElementById('recommendation-list');
        container.innerHTML = '';
        
        // Show target calories if height and weight exist
        const p = getProfile();
        const calBadge = document.getElementById('rec-target-calories');
        if (calBadge) {
            if (p.height && p.weight) {
                const targetCal = getTargetCalories();
                calBadge.innerText = `🎯 한 끼 권장: ${targetCal} kcal`;
                calBadge.style.display = 'block';
            } else {
                calBadge.style.display = 'none';
            }
        }
        
        if (recs.length === 0) {
            container.innerHTML = '<p>추천할 수 있는 메뉴가 없습니다. 블랙리스트나 알레르기 설정을 확인해주세요.</p>';
            return;
        }

        recs.forEach(menu => {
            const card = document.createElement('div');
            card.className = 'menu-card';
            
            // Category color mapping
            const colors = {'한식':'#E2605E', '중식':'#E8B44A', '일식':'#5B89C6', '양식':'#9360BD'};
            const catColor = colors[menu.category] || '#333';
            
            // Determine image source
            let imgHtml;
            if (menu.image) {
                imgHtml = `<img class="menu-image" src="${menu.image}" alt="${menu.name}">`;
            } else {
                imgHtml = `<div class="menu-placeholder" style="color: ${catColor};">${getCategoryEmoji(menu.category)}</div>`;
            }

            card.innerHTML = `
                <div class="cat-label" style="background-color: ${catColor};">${menu.category}</div>
                <div class="menu-content">
                    ${imgHtml}
                    <div class="menu-name">${menu.name}</div>
                    <div class="menu-cal">${menu.cal} kcal</div>
                    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                        <button class="btn select">이거 먹을래요!</button>
                        <button class="btn find-map" style="background: #03C75A; color: white;">주변 식당 찾기 📍</button>
                    </div>
                </div>
            `;
            
            // Add to history
            card.querySelector('.select').addEventListener('click', () => {
                const today = new Date().toISOString().split('T')[0];
                addHistory(today, menu.id);
                alert(`${menu.name}을(를) 식사 기록에 추가했습니다!`);
                switchView('view-history');
            });

            // Open Naver Maps
            card.querySelector('.find-map').addEventListener('click', () => {
                const searchName = menu.name;
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            // Naver Map v5 coordinate parameter format: c=longitude,latitude,zoom
                            const url = `https://map.naver.com/v5/search/${encodeURIComponent(searchName)}?c=${lng},${lat},15,0,0,0,dh`;
                            window.open(url, '_blank');
                        },
                        (error) => {
                            console.warn("위치 정보를 가져올 수 없습니다.", error);
                            const url = `https://map.naver.com/v5/search/${encodeURIComponent(searchName)}`;
                            window.open(url, '_blank');
                        },
                        { timeout: 5000, enableHighAccuracy: true }
                    );
                } else {
                    const url = `https://map.naver.com/v5/search/${encodeURIComponent(searchName)}`;
                    window.open(url, '_blank');
                }
            });

            container.appendChild(card);
        });
    };

    document.getElementById('btn-reroll').addEventListener('click', () => {
        triggerRecommendation(selectedCategory);
    });

    const getCategoryEmoji = (cat) => {
        if(cat==='한식') return '🍲';
        if(cat==='중식') return '🥟';
        if(cat==='일식') return '🍣';
        return '🍔';
    };


    // --- Profile Settings ---
    const loadProfile = () => {
        const p = getProfile();
        document.getElementById('health-height').value = p.height;
        document.getElementById('health-weight').value = p.weight;
        document.getElementById('health-age').value = p.age;
        
        document.querySelectorAll('input[name="goal"]').forEach(el => {
            el.checked = (el.value === p.goal);
        });
        document.querySelectorAll('input[name="gender"]').forEach(el => {
            el.checked = (el.value === p.gender);
        });

        renderTags('allergy-tags', p.allergies, 'allergy');
        renderTags('dislike-tags', p.dislikes, 'dislike');
    };

    document.getElementById('btn-save-health').addEventListener('click', () => {
        const p = getProfile();
        p.height = document.getElementById('health-height').value;
        p.weight = document.getElementById('health-weight').value;
        p.age = document.getElementById('health-age').value;
        p.goal = document.querySelector('input[name="goal"]:checked').value;
        p.gender = document.querySelector('input[name="gender"]:checked').value;
        saveProfile(p);
        alert(`건강 설정이 저장되었습니다!\n목표 칼로리(1끼): ${getTargetCalories()} kcal`);
    });

    const renderTags = (containerId, items, type) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        items.forEach(item => {
            const span = document.createElement('span');
            span.className = 'tag-chip';
            span.innerHTML = `${item} <span class="remove">x</span>`;
            span.querySelector('.remove').addEventListener('click', () => {
                const p = getProfile();
                if(type === 'allergy') p.allergies = p.allergies.filter(x => x !== item);
                if(type === 'dislike') p.dislikes = p.dislikes.filter(x => x !== item);
                saveProfile(p);
                renderTags(containerId, type === 'allergy' ? p.allergies : p.dislikes, type);
            });
            container.appendChild(span);
        });
    };

    const addTag = (inputEl, type) => {
        const val = inputEl.value.trim();
        if(!val) return;
        const p = getProfile();
        const list = type === 'allergy' ? p.allergies : p.dislikes;
        if(!list.includes(val)) {
            list.push(val);
            saveProfile(p);
            renderTags(type === 'allergy' ? 'allergy-tags' : 'dislike-tags', list, type);
        }
        inputEl.value = '';
    };

    document.getElementById('allergy-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') addTag(e.target, 'allergy');
    });
    document.getElementById('dislike-input').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') addTag(e.target, 'dislike');
    });

    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.innerText;
            const type = btn.dataset.type;
            const p = getProfile();
            const list = type === 'allergy' ? p.allergies : p.dislikes;
            if(!list.includes(val)) {
                list.push(val);
                saveProfile(p);
                renderTags(type === 'allergy' ? 'allergy-tags' : 'dislike-tags', list, type);
            }
        });
    });


    // --- Calendar History ---
    let currentCalDate = new Date();
    
    const renderCalendar = () => {
        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        document.getElementById('cal-month-year').innerText = `${year}. ${month + 1}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        dayNames.forEach(d => {
            grid.innerHTML += `<div class="cal-day-header">${d}</div>`;
        });

        for(let i=0; i<firstDay; i++) {
            grid.innerHTML += `<div></div>`; // empty slots
        }

        const history = getHistory();
        const colors = {'한식':'#E2605E', '중식':'#E8B44A', '일식':'#5B89C6', '양식':'#9360BD'};

        for(let i=1; i<=daysInMonth; i++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            const meals = history[dateStr] || [];
            
            let dotsHtml = '';
            meals.forEach(mId => {
                const m = menus.find(x => x.id === mId);
                if(m) {
                    dotsHtml += `<div class="cal-dot" style="background-color: ${colors[m.category]}"></div>`;
                }
            });

            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            cell.innerHTML = `<div>${i}</div><div class="dot-container">${dotsHtml}</div>`;
            
            cell.addEventListener('click', () => {
                document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                showHistoryDetail(dateStr, meals);
            });
            grid.appendChild(cell);
        }
    };

    document.getElementById('cal-prev').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendar();
    });

    const showHistoryDetail = (dateStr, mealIds) => {
        const detailBox = document.getElementById('history-detail');
        const cardsContainer = document.getElementById('history-cards-container');
        document.getElementById('history-date-title').innerText = `${dateStr} 식사 기록`;
        
        if(mealIds.length === 0) {
            cardsContainer.innerHTML = '<p>식사 기록이 없습니다.</p>';
        } else {
            cardsContainer.innerHTML = '';
            mealIds.forEach(mId => {
                const m = menus.find(x => x.id === mId);
                if(!m) return;
                const colors = {'한식':'#E2605E', '중식':'#E8B44A', '일식':'#5B89C6', '양식':'#9360BD'};
                
                const c = document.createElement('div');
                c.className = 'history-card';
                c.style.backgroundColor = colors[m.category];
                c.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>${m.category}</span>
                        <span class="remove-history" style="cursor:pointer; font-weight:bold; font-size:16px;">&times;</span>
                    </div>
                    <div class="h-name">${m.name}</div>
                    <button class="btn text bl-btn blacklist-add-btn" style="color:white; text-decoration:underline; padding:0;">블랙리스트 추가</button>
                `;
                c.querySelector('.bl-btn').addEventListener('click', () => {
                    addBlacklist(m.name);
                    alert(`${m.name}을(를) 블랙리스트에 추가했습니다.`);
                });
                c.querySelector('.remove-history').addEventListener('click', () => {
                    if(confirm(`${m.name} 식사 기록을 삭제하시겠습니까?`)) {
                        removeHistory(dateStr, m.id);
                        const updatedMeals = getHistory()[dateStr] || [];
                        showHistoryDetail(dateStr, updatedMeals);
                        renderCalendar();
                    }
                });
                cardsContainer.appendChild(c);
            });
        }
        detailBox.style.display = 'block';
    };


    // --- Blacklist ---
    const renderBlacklist = () => {
        const bl = getBlacklist();
        
        // Group by category to match UI
        const contK = document.getElementById('bl-korean');
        const contC = document.getElementById('bl-chinese');
        const contJ = document.getElementById('bl-japanese');
        const contW = document.getElementById('bl-western');
        
        contK.innerHTML = ''; contC.innerHTML = ''; contJ.innerHTML = ''; contW.innerHTML = '';

        bl.forEach(keyword => {
            // Find which category this keyword belongs to. 
            // If keyword matches multiple menus, just pick the first match category.
            const matchedMenu = menus.find(m => m.name.includes(keyword));
            const cat = matchedMenu ? matchedMenu.category : '기타';

            const chip = document.createElement('div');
            chip.className = 'bl-item';
            chip.innerHTML = `<span>${keyword}</span> <span class="remove">x</span>`;
            chip.querySelector('.remove').addEventListener('click', () => {
                removeBlacklist(keyword);
                renderBlacklist();
            });

            if(cat === '한식') contK.appendChild(chip);
            else if(cat === '중식') contC.appendChild(chip);
            else if(cat === '일식') contJ.appendChild(chip);
            else contW.appendChild(chip); // Fallback to western row for others
        });
    };

    // --- Mandalart ---
    const renderMandalart = () => {
        const grid = document.getElementById('mandalart-grid');
        if (!grid) return;
        
        const rows = [
            ['청국장 찌개','bg-pink', '순두부 찌개','bg-pink', '고추장 찌개','bg-pink', '갈비탕','', '닭볶음탕','', '스테이크','', '연근조림','bg-mint', '시금치 무침','bg-mint', '감자조림','bg-mint'],
            ['부대찌개','bg-pink', '김치찌개','bg-pink', '된장찌개','bg-pink', '아구찜','', '삼계탕','', '수육','', '갈치찜','bg-mint', '장조림','bg-mint', '진미채 볶음','bg-mint'],
            ['비지찌개','bg-pink', '전찌개','bg-pink', '동태찌개','bg-pink', '월남쌈','', '불고기','', '찜닭','', '콩조림','bg-mint', '콩나물 무침','bg-mint', '멸치볶음','bg-mint'],
            ['제육덮밥','', '비빔밥','', '오므라이스','', '찌개','center-pink', '특식','center-yellow', '밑반찬','center-mint', '토스트','', '타코','', '떡꼬치',''],
            ['카레덮밥','', '김치 볶음밥','', '오징어 덮밥','', '덮/볶음밥','center-yellow', '뭐먹지','center-main', '간식','center-yellow', '쿠키','', '떡볶이','', '호떡',''],
            ['짜장밥','', '야채 볶음밥','', '간장 계란밥','', '국','center-blue', '야식/술안주','center-yellow', '면','center-orange', '샌드위치','', '시리얼','', '부침개',''],
            ['육개장','bg-blue', '떡국','bg-blue', '미역국','bg-blue', '두부김치','', '튀김','', '소시지 야채볶음','', '라면','bg-orange', '스파게티','bg-orange', '냉면','bg-orange'],
            ['콩나물국','bg-blue', '북엇국','bg-blue', '소고기 무국','bg-blue', '콘치즈','', '골뱅이 무침','', '부침개','', '잔치국수','bg-orange', '비빔국수','bg-orange', '칼국수','bg-orange'],
            ['시래깃국','bg-blue', '된장국','bg-blue', '감자탕','bg-blue', '어묵탕','', '닭똥집 튀김','', '순대볶음','', '우동','bg-orange', '볶음우동','bg-orange', '콩국수','bg-orange']
        ];
        
        let html = '';
        for(let i = 0; i < rows.length; i++) {
            const row = rows[i];
            for(let j = 0; j < row.length; j += 2) {
                const text = row[j];
                const bgClass = row[j+1];
                html += `<div class="mandalart-cell ${bgClass}">${text}</div>`;
            }
        }
        grid.innerHTML = html;
    };

    // Initialize
    loadProfile();
    renderMandalart();
});
