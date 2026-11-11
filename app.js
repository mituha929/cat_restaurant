/**
 * 🐾 貓咪主廚工作坊 (Cat Chef Workshop) - 核心遊戲引擎
 * 採用純原生 ES6 JS + CDN 動態效果庫 (GSAP & Anime.js)
 * 整合全 Web Audio API 程序化合成音訊引擎 (無外部版權音檔依賴)
 */

"use strict";

// ==========================================================================
// 1. 遊戲核心狀態 (Game State)
// ==========================================================================
const state = {
    // 玩家養成數值
    level: 1,
    exp: 0,
    gold: 0,
    hearts: 3,

    // 模式狀態
    isPaused: false,
    orientationLocked: false,
    wasPausedBeforeOrientation: false,
    isFever: false,
    feverTimeLeft: 0,
    isEndless: false,
    gameStarted: false, // 標記遊戲是否已啟動，用以判定暫停或重開

    // 合成槽狀態
    potSlots: [],           // 依照拖入順序記錄食材，支援多步驟料理
    prepStation: null,
    completedDish: null,    // 成品出餐盤上的料理
    isCooking: false,
    pendingCookTimer: null,
    completedDishBurnTimer: null,
    ingredientStock: {},
    restockingId: null,
    equipment: {
        stoveLeft: { hasItem: false, recipe: null, running: false, fireOn: false, kind: null },
        stoveRight: { hasItem: false, recipe: null, running: false, fireOn: false, kind: null },
        oven: { hasItem: false, recipe: null, running: false, closed: false }
    },

    // 客席座狀態
    guests: [
        { active: false, type: null, order: null, patience: 100, maxPatience: 100, timer: null },
        { active: false, type: null, order: null, patience: 100, maxPatience: 100, timer: null },
        { active: false, type: null, order: null, patience: 100, maxPatience: 100, timer: null }
    ],

    // 老鼠干擾事件狀態
    mouseActive: false,
    mouseTimer: null,
    mouseTargetNode: null,
    mouseAnim: null,

    // 音訊控制器
    audio: {
        ctx: null,
        bgmNode: null,
        isPlayingBgm: false,
        bgmInterval: null,
        bgmTempo: 220, // 毫秒/拍 (Fever Time 時縮短為 160)
        bgmStep: 0
    }
};

// ==========================================================================
// 2. 靜態配置：食材、食譜、貓咪種類
// ==========================================================================

// 8 種基礎食材及其解鎖等級
const INGREDIENTS = {
    fish:   { id: "fish",   name: "鮪魚", emoji: "🐟", unlockLevel: 1 },
    meat:   { id: "meat",   name: "雞肉片", emoji: "🍗", unlockLevel: 1 },
    shrimp: { id: "shrimp", name: "鮮蝦", emoji: "🍤", unlockLevel: 1 },
    rice:   { id: "rice",   name: "白飯", emoji: "🍚", unlockLevel: 1 },
    toast:  { id: "toast",  name: "吐司片", emoji: "🍞", unlockLevel: 1 },
    cheese: { id: "cheese", name: "起司片", emoji: "🧀", unlockLevel: 1 },
    milk:   { id: "milk",   name: "牛奶", emoji: "🥛", unlockLevel: 1 },
    burger: { id: "burger", name: "漢堡包", emoji: "🍔", unlockLevel: 1 }
};

const INGREDIENT_IMAGE_PATHS = {
    fish: "assets/ingredients/fish.png",
    rice: "assets/ingredients/rice.png",
    meat: "assets/ingredients/meat.png",
    cheese: "assets/ingredients/cheese.png",
    milk: "assets/ingredients/milk.png",
    shrimp: "assets/ingredients/shrimp.png",
    toast: "assets/ingredients/toast.png",
    burger: "assets/ingredients/burger.png"
};

const PREP_ITEMS = {
    sushi_rice: { id: "sushi_rice", name: "壽司飯", emoji: "🍚", image: "assets/dishes/tuna_sushi_rice.png" },
    onigiri_rice: { id: "onigiri_rice", name: "飯糰米飯", emoji: "🍙", image: "assets/equipment/onigiri_filled.png" }
};

function getItemMeta(id) {
    return INGREDIENTS[id] || PREP_ITEMS[id] || { id, name: id, emoji: "❓" };
}

function getIngredientImagePath(id) {
    if (PREP_ITEMS[id]) return PREP_ITEMS[id].image;
    return INGREDIENT_IMAGE_PATHS[id] || `assets/imgs/${id}.png`;
}

const RECIPE_LIST = [
    { station: "assembly", steps: ["sushi_rice", "fish"], id: "tuna_sushi", name: "鮪魚壽司", emoji: "🍣", time: 0, image: "assets/dishes/tuna_sushi.png" },
    { station: "assembly", steps: ["sushi_rice", "shrimp"], id: "shrimp_sushi", name: "鮮蝦壽司", emoji: "🍣", time: 0, image: "assets/dishes/shrimp_sushi.png" },
    { station: "assembly", steps: ["sushi_rice", "meat"], id: "chicken_sushi", name: "雞肉片壽司", emoji: "🍣", time: 0, image: "assets/dishes/chicken_sushi.png" },
    { station: "assembly", steps: ["onigiri_rice", "meat"], id: "chicken_onigiri", name: "雞肉片飯糰", emoji: "🍙", time: 0, image: "assets/dishes/chicken_onigiri.png" },
    { station: "assembly", steps: ["burger", "meat", "burger"], id: "chicken_burger", name: "雞肉片漢堡", emoji: "🍔", time: 0, image: "assets/dishes/chicken_burger.png" },
    { station: "assembly", steps: ["burger", "cheese", "burger"], id: "cheeseburger", name: "起司漢堡", emoji: "🍔", time: 0, image: "assets/dishes/cheeseburger.png" },
    { station: "assembly", steps: ["toast", "meat", "toast", "meat", "toast"], id: "chicken_sandwich", name: "雞肉三明治", emoji: "🥪", time: 0, image: "assets/dishes/chicken_sandwich.png" },
    { station: "assembly", steps: ["toast", "cheese", "toast", "cheese", "toast"], id: "cheese_sandwich", name: "起司三明治", emoji: "🥪", time: 0, image: "assets/dishes/cheese_sandwich.png" },
    { station: "stove", steps: ["milk", "cheese"], id: "cheese_milk_soup", name: "起司牛奶濃湯", emoji: "🍲", time: 5, image: "assets/dishes/cheese_milk_soup.png" },
    { station: "stove", steps: ["milk", "cheese", "fish"], id: "tuna_cheese_soup", name: "鮪魚起司濃湯", emoji: "🍲", time: 5, image: "assets/dishes/tuna_cheese_soup.png" },
    { station: "stove", steps: ["rice", "shrimp", "cheese"], id: "cheese_shrimp_rice", name: "起司鮮蝦炒飯", emoji: "🍳", time: 5, image: "assets/dishes/cheese_shrimp_rice.png" },
    { station: "stove", steps: ["rice", "fish", "shrimp", "milk"], id: "seafood_milk_risotto", name: "牛奶海鮮燉飯", emoji: "🥘", time: 5, image: "assets/dishes/seafood_milk_risotto.png" },
    { station: "stove", steps: ["rice", "meat"], id: "chicken_risotto", name: "雞肉燉飯", emoji: "🥘", time: 5, image: "assets/dishes/chicken_risotto.png" },
    { station: "oven", steps: ["rice", "cheese", "fish"], id: "baked_tuna_rice", name: "焗烤起司鮪魚飯", emoji: "🧀", time: 5, image: "assets/dishes/baked_tuna_rice.png" },
    { station: "oven", steps: ["rice", "cheese", "meat"], id: "baked_chicken_rice", name: "焗烤起司雞肉飯", emoji: "🧀", time: 5, image: "assets/dishes/baked_chicken_rice.png" },
    { station: "oven", steps: ["rice", "shrimp", "cheese"], id: "baked_shrimp_rice", name: "焗烤起司鮮蝦飯", emoji: "🧀", time: 5, image: "assets/dishes/baked_shrimp_rice.png" }
];

function getDishImagePath(dish) {
    if (dish && dish.isBurnt) return "assets/equipment/burnt.png";
    return dish.image || `assets/imgs/${dish.id}.png`;
}

const PREP_STAGE_IMAGES = {
    "assembly|sushi_rice": "assets/dishes/tuna_sushi_rice.png",
    "assembly|sushi_rice+fish": "assets/dishes/tuna_sushi.png",
    "assembly|sushi_rice+shrimp": "assets/dishes/shrimp_sushi.png",
    "assembly|sushi_rice+meat": "assets/dishes/chicken_sushi.png",
    "assembly|onigiri_rice": "assets/equipment/onigiri_filled.png",
    "assembly|onigiri_rice+meat": "assets/dishes/chicken_onigiri.png",
    "assembly|burger": "assets/dishes/chicken_burger_bottom.png",
    "assembly|burger+meat": "assets/dishes/chicken_burger_bottom_meat.png",
    "assembly|burger+meat+burger": "assets/dishes/chicken_burger.png",
    "assembly|burger+cheese": "assets/dishes/cheeseburger_bottom_cheese.png",
    "assembly|burger+cheese+burger": "assets/dishes/cheeseburger.png",
    "assembly|toast": "assets/dishes/chicken_sandwich_toast.png",
    "assembly|toast+meat": "assets/dishes/chicken_sandwich_toast_meat.png",
    "assembly|toast+meat+toast": "assets/dishes/chicken_sandwich_toast_meat_toast.png",
    "assembly|toast+meat+toast+meat": "assets/dishes/chicken_sandwich_toast_meat_toast_meat.png",
    "assembly|toast+meat+toast+meat+toast": "assets/dishes/chicken_sandwich.png",
    "assembly|toast+cheese": "assets/dishes/cheese_sandwich_toast_cheese.png",
    "assembly|toast+cheese+toast": "assets/dishes/cheese_sandwich_toast_cheese_toast.png",
    "assembly|toast+cheese+toast+cheese": "assets/dishes/cheese_sandwich_toast_cheese_toast_cheese.png",
    "assembly|toast+cheese+toast+cheese+toast": "assets/dishes/cheese_sandwich.png",
    "stove|milk": "assets/dishes/cheese_milk_soup_milk.png",
    "stove|milk+cheese": "assets/dishes/cheese_milk_soup_milk_cheese.png",
    "stove|milk+cheese+fish": "assets/dishes/tuna_cheese_soup_milk_cheese_fish.png",
    "stove|rice": "assets/dishes/chicken_risotto_rice.png",
    "stove|rice+meat": "assets/dishes/chicken_risotto_rice_meat.png",
    "stove|rice+shrimp": "assets/dishes/cheese_shrimp_rice_rice_shrimp.png",
    "stove|rice+shrimp+cheese": "assets/dishes/cheese_shrimp_rice_rice_shrimp_cheese.png",
    "stove|rice+fish": "assets/dishes/seafood_milk_risotto_rice_fish.png",
    "stove|rice+fish+shrimp": "assets/dishes/seafood_milk_risotto_rice_fish_shrimp.png",
    "stove|rice+fish+shrimp+milk": "assets/dishes/seafood_milk_risotto_rice_fish_shrimp_milk.png",
    "oven|rice": "assets/dishes/baked_tuna_rice_rice.png",
    "oven|rice+cheese": "assets/dishes/baked_tuna_rice_rice_cheese.png",
    "oven|rice+cheese+fish": "assets/dishes/baked_tuna_rice_rice_cheese_fish.png",
    "oven|rice+cheese+meat": "assets/dishes/baked_chicken_rice_rice_cheese_meat.png",
    "oven|rice+shrimp": "assets/dishes/baked_shrimp_rice_rice_shrimp.png",
    "oven|rice+shrimp+cheese": "assets/dishes/baked_shrimp_rice_rice_shrimp_cheese.png"
};

function getPrepStageImagePath() {
    if (!state.prepStation || state.potSlots.length === 0) return "";
    return PREP_STAGE_IMAGES[`${state.prepStation}|${state.potSlots.join('+')}`] || "";
}

// 8 種可愛貓咪品種
const CAT_BREEDS = [
    { breed: "orange",    name: "大橘貓", emoji: "😺", color: "#F39C12" },
    { breed: "siamese",   name: "暹羅貓", emoji: "😽", color: "#D35400" },
    { breed: "calico",    name: "三花貓", emoji: "😸", color: "#E67E22" },
    { breed: "tuxedo",    name: "賓士貓", emoji: "😼", color: "#2C3E50" },
    { breed: "black",     name: "神秘黑貓", emoji: "🐈‍⬛", color: "#34495E" },
    { breed: "persian",   name: "獅王波斯", emoji: "😻", color: "#F1C40F" },
    { breed: "shorthair", name: "英短藍貓", emoji: "😾", color: "#7F8C8D" }
];

const CAT_WALK_IMAGE_PREFIX = {
    orange: "orange_cat",
    siamese: "siamese_cat",
    calico: "calico_cat",
    tuxedo: "tuxedo_cat",
    black: "black_cat",
    persian: "persian_cat",
    shorthair: "british_cat"
};

function getCatWalkFrames(catType) {
    const prefix = CAT_WALK_IMAGE_PREFIX[catType.breed];
    if (!prefix) return null;
    return {
        first: `cat_walk/${prefix}_walk1.png`,
        second: `cat_walk/${prefix}_walk2.png`
    };
}

// ==========================================================================
// 3. Web Audio API 自訂程序化合成音訊引擎 (無版權爭議)
// ==========================================================================

function initAudio() {
    if (!state.audio.ctx) {
        state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// 播放簡單的蜂鳴/方波音符 (合成可愛 Chiptune BGM)
function playSynthNote(freq, duration, type = "triangle", volume = 0.08) {
    if (!state.audio.ctx) return;
    const ctx = state.audio.ctx;
    
    // 如果被瀏覽器阻擋則嘗試重啟
    if (ctx.state === "suspended") {
        ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
}

// 程序化循環播放背景 Chiptune 音樂
function startSynthesizedBgm() {
    if (state.audio.isPlayingBgm) return;
    initAudio();
    state.audio.isPlayingBgm = true;

    // 溫暖可愛的 8-bit 和弦琶音 (C大調與F大調循環)
    const melody = [
        261.63, 329.63, 392.00, 523.25, 392.00, 329.63,
        293.66, 349.23, 392.00, 587.33, 392.00, 349.23,
        220.00, 261.63, 329.63, 440.00, 329.63, 261.63,
        261.63, 349.23, 440.00, 523.25, 440.00, 349.23
    ];

    function tickBgm() {
        if (state.isPaused || !state.audio.isPlayingBgm) return;

        const currentFreq = melody[state.audio.bgmStep % melody.length];
        if (state.audio.bgmStep % 6 === 0) {
            playSynthNote(currentFreq / 2, 0.35, "sine", 0.15); // 重低音拍
        }
        
        const noteType = state.isFever ? "square" : "triangle";
        const volume = state.isFever ? 0.08 : 0.05;
        playSynthNote(currentFreq, state.audio.bgmTempo / 1000 * 1.5, noteType, volume);

        state.audio.bgmStep++;
    }

    state.audio.bgmInterval = setInterval(tickBgm, state.audio.bgmTempo);
}

function stopSynthesizedBgm() {
    state.audio.isPlayingBgm = false;
    if (state.audio.bgmInterval) {
        clearInterval(state.audio.bgmInterval);
    }
}

// BGM 速度調整 (Fever Time 時倍速)
function updateBgmTempo(isFeverMode) {
    stopSynthesizedBgm();
    state.audio.bgmTempo = isFeverMode ? 160 : 230;
    startSynthesizedBgm();
}

// ----可愛自製音效 (SFX) ----
const SFX = {
    playSizzle() {
        initAudio();
        const ctx = state.audio.ctx;
        if (!ctx) return;
        const bufferSize = ctx.sampleRate * 0.18;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.18);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    playSuccess() {
        initAudio();
        setTimeout(() => playSynthNote(523.25, 0.15, "sine", 0.2), 0);
        setTimeout(() => playSynthNote(783.99, 0.25, "sine", 0.15), 100);
    },

    playBurnt() {
        initAudio();
        const ctx = state.audio.ctx;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(45, ctx.currentTime + 0.45);

        mod.frequency.setValueAtTime(35, ctx.currentTime);
        modGain.gain.setValueAtTime(80, ctx.currentTime);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        mod.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        mod.start();
        osc.stop(ctx.currentTime + 0.45);
        mod.stop(ctx.currentTime + 0.45);
    },

    playLevelUp() {
        initAudio();
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, index) => {
            setTimeout(() => {
                playSynthNote(freq, 0.22, "triangle", 0.15);
            }, index * 85);
        });
    },

    playAlert() {
        initAudio();
        const ctx = state.audio.ctx;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        for (let i = 0; i < 6; i++) {
            osc.frequency.setValueAtTime(880, ctx.currentTime + i * 0.1);
            osc.frequency.setValueAtTime(1200, ctx.currentTime + i * 0.1 + 0.05);
        }

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    },

    playSqueak() {
        initAudio();
        setTimeout(() => playSynthNote(1100, 0.08, "sine", 0.22), 0);
        setTimeout(() => playSynthNote(1600, 0.12, "sine", 0.18), 50);
    },

    playClick() {
        initAudio();
        playSynthNote(180, 0.08, "sine", 0.25);
    }
};

// ==========================================================================
// 4. 核心 UI 渲染與等級系統
// ==========================================================================

function getExpThreshold(n) {
    return 100 * (n * (n + 1)) / 2;
}

function getUnlockedIngredients() {
    return Object.values(INGREDIENTS).filter(ing => state.level >= ing.unlockLevel);
}

function initIngredientStock() {
    Object.keys(INGREDIENTS).forEach(id => {
        if (typeof state.ingredientStock[id] !== "number") {
            state.ingredientStock[id] = 10;
        }
    });
}

function getIngredientStockVisual(stock) {
    if (stock > 7) {
        return {
            className: "stock-high",
            gradient: "linear-gradient(90deg, #43bf48, #8ce34a)"
        };
    }
    if (stock > 3) {
        return {
            className: "stock-medium",
            gradient: "linear-gradient(90deg, #f4c542, #ffe66d)"
        };
    }
    return {
        className: "stock-low",
        gradient: "linear-gradient(90deg, #ef4d3f, #ff8a65)"
    };
}

function bindRestockButton(box, id) {
    const btn = box.querySelector(".restock-btn");
    if (!btn) return;

    ["pointerdown", "mousedown", "touchstart"].forEach(eventName => {
        btn.addEventListener(eventName, event => {
            event.stopPropagation();
        });
    });

    btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        restockIngredient(id);
    });
}

function renderIngredientBoxContent(box, ing) {
    const isLocked = state.level < ing.unlockLevel;
    const stock = state.ingredientStock[ing.id] || 0;
    const isRestocking = state.restockingId === ing.id;
    const stockVisual = getIngredientStockVisual(stock);

    box.className = "ingredient-box";
    box.dataset.id = ing.id;

    if (isLocked) {
        box.classList.add("locked");
        box.innerHTML = `<span class="unlock-level-hint">Lv.${ing.unlockLevel} 解鎖</span>`;
        return;
    }

    if (stock <= 0 || isRestocking) {
        box.classList.add("locked", "empty-stock");
        box.innerHTML = `
            <div class="ingredient-emoji">
                <img src="${getIngredientImagePath(ing.id)}" onerror="this.outerHTML='<span class=fallback-emoji>${ing.emoji}</span>'" class="ingredient-img">
            </div>
            <div class="ingredient-name">${ing.name}</div>
            <div class="stock-meter stock-low"><span style="width: ${isRestocking ? 100 : 0}%; background: linear-gradient(90deg, #ef4d3f, #ff8a65);"></span></div>
            <button class="restock-btn" ${isRestocking || state.gold < 100 ? "disabled" : ""}>${isRestocking ? "補貨中..." : "補貨 $100"}</button>
        `;
        bindRestockButton(box, ing.id);
        return;
    }

    const restockButton = stock < 10
        ? `<button class="restock-btn" ${state.gold < 100 ? "disabled" : ""}>補貨 $100</button>`
        : "";

    box.innerHTML = `
        <div class="ingredient-emoji">
            <img src="${getIngredientImagePath(ing.id)}" onerror="this.outerHTML='<span class=fallback-emoji>${ing.emoji}</span>'" class="ingredient-img">
        </div>
        <div class="ingredient-name">${ing.name}</div>
        <div class="stock-meter ${stockVisual.className}"><span style="width: ${Math.min(100, stock * 10)}%; background: ${stockVisual.gradient};"></span></div>
        <div class="stock-count ${stockVisual.className}">${stock}/10</div>
        ${restockButton}
    `;
    bindRestockButton(box, ing.id);
    setupIngredientDraggable(box);
}

function updateIngredientBox(id) {
    const ing = INGREDIENTS[id];
    const box = document.querySelector(`.ingredient-box[data-id="${id}"]`);
    if (!ing || !box) {
        renderIngredientsShelf();
        return;
    }

    const draggable = typeof Draggable !== "undefined" ? Draggable.get(box) : null;
    if (draggable) draggable.kill();
    renderIngredientBoxContent(box, ing);
}

function updateAllIngredientBoxes() {
    Object.keys(INGREDIENTS).forEach(updateIngredientBox);
}

function restockIngredient(id) {
    if (state.restockingId || !INGREDIENTS[id]) return;
    const currentStock = state.ingredientStock[id] || 0;
    if (currentStock >= 10) return;
    if (state.gold < 100) {
        SFX.playBurnt();
        return;
    }

    state.gold -= 100;
    state.restockingId = id;
    updateHUD();
    updateAllIngredientBoxes();

    setTimeout(() => {
        state.ingredientStock[id] = 10;
        state.restockingId = null;
        updateAllIngredientBoxes();
        SFX.playSuccess();
    }, 3000);
}

// 重新設計架上食材，改為直接將 Shelf Box 作為 Draggable 對象，修復無法拖曳進鍋的 bug
function renderIngredientsShelf() {
    const shelf = document.getElementById("ingredients-shelf");
    shelf.innerHTML = "";
    initIngredientStock();

    Object.values(INGREDIENTS).forEach(ing => {
        const box = document.createElement("div");
        renderIngredientBoxContent(box, ing);
        shelf.appendChild(box);
    });

    animateIngredientShelf();
    return;

    Object.values(INGREDIENTS).forEach(ing => {
        const box = document.createElement("div");
        box.classList.add("ingredient-box");
        box.dataset.id = ing.id;

        const isLocked = state.level < ing.unlockLevel;
        const stock = state.ingredientStock[ing.id] || 0;
        const isRestocking = state.restockingId === ing.id;
        const stockLevelClass = stock > 7 ? "stock-high" : stock > 3 ? "stock-medium" : "stock-low";
        const stockLevelGradient = stock > 7
            ? "linear-gradient(90deg, #43bf48, #8ce34a)"
            : stock > 3
                ? "linear-gradient(90deg, #f4c542, #ffe66d)"
                : "linear-gradient(90deg, #ef4d3f, #ff8a65)";
        if (isLocked) {
            box.classList.add("locked");
            box.innerHTML = `<span class="unlock-level-hint">Lv.${ing.unlockLevel} 解鎖</span>`;
        } else if (stock <= 0 || isRestocking) {
            box.classList.add("locked", "empty-stock");
            box.innerHTML = `
                <div class="ingredient-emoji">
                    <img src="${getIngredientImagePath(ing.id)}" onerror="this.outerHTML='<span class=fallback-emoji>${ing.emoji}</span>'" class="ingredient-img">
                </div>
                <div class="ingredient-name">${ing.name}</div>
                <div class="stock-meter stock-low"><span style="width: ${isRestocking ? 100 : 0}%; background: linear-gradient(90deg, #ef4d3f, #ff8a65);"></span></div>
                <button class="restock-btn" ${isRestocking || state.gold < 100 ? "disabled" : ""}>${isRestocking ? "補貨中..." : "補貨 $100"}</button>
            `;
            const btn = box.querySelector(".restock-btn");
            if (btn) {
                btn.addEventListener("click", event => {
                    event.stopPropagation();
                    restockIngredient(ing.id);
                });
            }
        } else {
            box.innerHTML = `
                <div class="ingredient-emoji">
                    <img src="${getIngredientImagePath(ing.id)}" onerror="this.outerHTML='<span class=fallback-emoji>${ing.emoji}</span>'" class="ingredient-img">
                </div>
                <div class="ingredient-name">${ing.name}</div>
                <div class="stock-meter ${stockLevelClass}"><span style="width: ${Math.min(100, stock * 10)}%; background: ${stockLevelGradient};"></span></div>
                <div class="stock-count ${stockLevelClass}">${stock}/10</div>
                <button class="restock-btn" ${stock >= 10 || state.gold < 100 ? "disabled" : ""}>補貨 $100</button>
            `;
            const btn = box.querySelector(".restock-btn");
            if (btn) {
                btn.addEventListener("click", event => {
                    event.stopPropagation();
                    restockIngredient(ing.id);
                });
            }
            // 綁定 GSAP Draggable 物理拖曳
            setupIngredientDraggable(box);
        }
        shelf.appendChild(box);
    });

    animateIngredientShelf();
}

// 渲染食譜圖鑑卡片 (附 3D 180度翻轉)
function animateIngredientShelf() {
    if (typeof anime === "undefined") return;

    anime.remove("#ingredients-shelf .ingredient-box");
    anime({
        targets: "#ingredients-shelf .ingredient-box",
        opacity: [0, 1],
        translateY: [14, 0],
        scale: [0.94, 1],
        delay: anime.stagger(55),
        duration: 420,
        easing: "easeOutBack"
    });
}

function animateRecipeCards() {
    if (typeof anime === "undefined") return;

    anime.remove("#recipes-grid .card-container");
    anime({
        targets: "#recipes-grid .card-container",
        opacity: [0, 1],
        translateY: [20, 0],
        rotateX: [-10, 0],
        delay: anime.stagger(45),
        duration: 460,
        easing: "easeOutCubic"
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getStationLabel(station) {
    const labels = {
        assembly: "出餐準備區",
        stove: "瓦斯爐區",
        oven: "烤箱區"
    };
    return labels[station] || station;
}

function getRecipeActionText(recipe, step, index) {
    const itemName = getItemMeta(step).name;
    if (recipe.station === "assembly") {
        return `第 ${index + 1} 步：將「${itemName}」放到出餐準備區。`;
    }
    if (recipe.station === "stove") {
        return `第 ${index + 1} 步：將「${itemName}」放入鍋子。`;
    }
    if (recipe.station === "oven") {
        return `第 ${index + 1} 步：將「${itemName}」放到烤盤。`;
    }
    return `第 ${index + 1} 步：加入「${itemName}」。`;
}

function getRecipeFinishText(recipe) {
    if (recipe.station === "stove") {
        return `最後：把鍋子放到瓦斯爐區，開火等待 ${recipe.time} 秒完成。`;
    }
    if (recipe.station === "oven") {
        return `最後：把烤盤放到烤箱區，關上烤箱等待 ${recipe.time} 秒完成。`;
    }
    return "最後：依照順序放完食材後，就會直接完成料理。";
}

function renderRecipeFlow(recipe) {
    const chunkSize = recipe.steps.length > 4 ? Math.ceil(recipe.steps.length / 2) : recipe.steps.length;
    const rows = [];

    for (let i = 0; i < recipe.steps.length; i += chunkSize) {
        rows.push(recipe.steps.slice(i, i + chunkSize));
    }

    return rows.map((row) => `
        <div class="recipe-step-row">
            ${row.map((step, index) => `
                ${index > 0 ? `<span class="plus-sign">→</span>` : ""}
                <span class="recipe-step-icon" title="${escapeHtml(getItemMeta(step).name)}">
                    <img src="${getIngredientImagePath(step)}" onerror="this.outerHTML='<span>${getItemMeta(step).emoji}</span>'" class="recipe-ing-img">
                </span>
            `).join("")}
        </div>
    `).join("");
}

function renderRecipeDetail(recipe) {
    const lines = [
        `使用區域：${getStationLabel(recipe.station)}。`,
        ...recipe.steps.map((step, index) => getRecipeActionText(recipe, step, index)),
        getRecipeFinishText(recipe)
    ];

    return `
        <div class="recipe-detail-panel">
            <div class="recipe-detail-title">詳細步驟說明</div>
            <ol>
                ${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}
            </ol>
        </div>
    `;
}

function renderRecipeBook() {
    const grid = document.getElementById("recipes-grid");
    grid.innerHTML = "";

    const unlockedIds = getUnlockedIngredients().map(i => i.id);

    RECIPE_LIST.forEach(value => {
        const isRecipeLocked = value.steps.some(step => INGREDIENTS[step] && !unlockedIds.includes(step));

        const card = document.createElement("div");
        card.classList.add("card-container");
        if (isRecipeLocked) {
            card.classList.add("locked-recipe");
        }

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <div class="dish-emoji">
                        ${isRecipeLocked ? "❓" : `<img src="${getDishImagePath(value)}" onerror="this.outerHTML='<span>${value.emoji}</span>'" class="book-dish-img">`}
                    </div>
                    <div class="dish-name">${isRecipeLocked ? "神祕隱藏料理" : value.name}</div>
                </div>
                <div class="card-back">
                    <div class="recipe-title">${value.time > 0 ? `${value.time} 秒製作` : "直接組裝"}</div>
                    <div class="recipe-flow ${value.steps.length > 4 ? "multi-line" : ""}">
                        ${renderRecipeFlow(value)}
                    </div>
                    <div class="recipe-result-name">${isRecipeLocked ? "?? 解鎖" : value.name}</div>
                    ${isRecipeLocked ? "" : `
                        <button class="recipe-detail-btn" type="button">詳細步驟說明</button>
                        ${renderRecipeDetail(value)}
                    `}
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            SFX.playClick();
            card.classList.toggle("flipped");
        });

        const detailBtn = card.querySelector(".recipe-detail-btn");
        if (detailBtn) {
            detailBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                SFX.playClick();
                card.classList.toggle("show-detail");
            });
        }

        const detailPanel = card.querySelector(".recipe-detail-panel");
        if (detailPanel) {
            detailPanel.addEventListener("click", (event) => {
                event.stopPropagation();
            });
        }

        grid.appendChild(card);
    });

    animateRecipeCards();
}

// 更新 HUD 顯示介面
function updateHUD() {
    document.getElementById("level-val").innerText = state.level;
    document.getElementById("gold-val").innerText = state.gold;

    const prevThreshold = state.level === 1 ? 0 : getExpThreshold(state.level - 1);
    const nextThreshold = getExpThreshold(state.level);
    const needed = nextThreshold - prevThreshold;
    const currentGained = state.exp - prevThreshold;
    const percent = Math.min(100, Math.max(0, (currentGained / needed) * 100));

    document.getElementById("exp-bar-fill").style.width = `${percent}%`;
    document.getElementById("exp-text").innerText = `EXP ${currentGained} / ${needed}`;

    const heartsContainer = document.getElementById("hearts-container");
    if (state.isEndless) {
        heartsContainer.classList.remove("hide");
        heartsContainer.innerHTML = "";
        for (let i = 0; i < 3; i++) {
            const heart = document.createElement("span");
            heart.classList.add("heart-slot");
            heart.innerText = "❤️";
            if (i >= state.hearts) {
                heart.classList.add("empty");
                heart.innerText = "🖤";
            }
            heartsContainer.appendChild(heart);
        }
    } else {
        heartsContainer.classList.add("hide");
    }
}

function addExp(amount) {
    state.exp += amount;
    const threshold = getExpThreshold(state.level);

    if (state.exp >= threshold) {
        levelUp();
    }
    updateHUD();
}

function levelUp() {
    state.level++;
    state.isPaused = true;
    SFX.playLevelUp();

    triggerConfettiEffect();

    const overlay = document.getElementById("levelup-overlay");
    const descText = overlay.querySelector(".levelup-desc");
    const emojiContainer = overlay.querySelector(".levelup-emoji");
    const hatCat = overlay.querySelector(".party-hat-cat");

    // 檢查此等級是否有新食材解鎖
    const hasNewIngredient = Object.values(INGREDIENTS).some(ing => ing.unlockLevel === state.level);
    
    // 動態拼裝符合規格書的說明文字 (換行與解鎖判定)
    let descHTML = "";
    if (state.level > 6) {
        descHTML += "bouns time!，送餐成功的經驗值與經幣翻倍<br>";
        emojiContainer.innerText = "🔥😸👑";
        hatCat.innerText = "😸🎩";
    } else {
        emojiContainer.innerText = "🎉😸👑";
        hatCat.innerText = "😸🎩";
    }
    
    descHTML += "升級啦！";
    if (hasNewIngredient) {
        descHTML += "新食材已成功解鎖";
    }

    descText.innerHTML = descHTML;
    overlay.classList.add("active");

    setTimeout(() => {
        overlay.classList.remove("active");
        state.isPaused = state.orientationLocked;
        
        let feverSeconds = 0;
        if (state.level >= 6 && state.level <= 10) feverSeconds = 20;
        else if (state.level >= 11 && state.level <= 15) feverSeconds = 40;
        else if (state.level >= 16 && state.level <= 20) feverSeconds = 60;
        else if (state.level >= 21) feverSeconds = 60; // 21等以下持續60秒

        if (feverSeconds > 0) {
            triggerFeverTime(feverSeconds);
        }

        if (state.level >= 21 && !state.isEndless) {
            enterEndlessMode();
        }

        renderIngredientsShelf();
        renderRecipeBook();
    }, 3000);
}

function triggerFeverTime(duration) {
    state.isFever = true;
    state.feverTimeLeft = duration;

    const badge = document.getElementById("fever-badge");
    const wrapper = document.getElementById("fever-timer-wrapper");
    const fill = document.getElementById("fever-timer-fill");
    const txt = document.getElementById("fever-timer-text");

    badge.classList.remove("hide");
    wrapper.classList.remove("hide");
    
    updateBgmTempo(true);

    const interval = setInterval(() => {
        if (state.isPaused) return;

        state.feverTimeLeft--;
        const pct = (state.feverTimeLeft / duration) * 100;
        fill.style.width = `${pct}%`;
        txt.innerText = `${state.feverTimeLeft}s`;

        if (state.feverTimeLeft <= 0) {
            clearInterval(interval);
            state.isFever = false;
            badge.classList.add("hide");
            wrapper.classList.add("hide");
            updateBgmTempo(false);
        }
    }, 1000);
}

function enterEndlessMode() {
    state.isEndless = true;
    state.hearts = 3;
    
    document.body.classList.add("michelin-theme");

    anime({
        targets: "#game-container",
        keyframes: [
            { scale: 0.95, filter: "brightness(1.5)", duration: 500 },
            { scale: 1.05, filter: "brightness(0.7)", duration: 500 },
            { scale: 1, filter: "brightness(1)", duration: 500 }
        ],
        easing: "easeInOutQuad"
    });

    updateHUD();
}

// ==========================================================================
// 5. 客席與貓咪座位管理 (Patience & Seating)
// ==========================================================================

function seatRandomCat(spotIndex) {
    const spotNode = document.getElementById(`spot-${spotIndex}`);
    spotNode.innerHTML = "";

    const unlockedIngs = getUnlockedIngredients().map(i => i.id);
    const validRecipes = RECIPE_LIST.filter(recipe => recipe.steps.every(step => !INGREDIENTS[step] || unlockedIngs.includes(step)));

    if (validRecipes.length === 0) return;
    
    const requestedDish = validRecipes[Math.floor(Math.random() * validRecipes.length)];
    const catType = CAT_BREEDS[Math.floor(Math.random() * CAT_BREEDS.length)];

    const guestObj = state.guests[spotIndex];
    guestObj.active = true;
    guestObj.type = catType;
    guestObj.order = requestedDish;
    guestObj.patience = 100;
    guestObj.maxPatience = Math.max(25, 100 - (state.level * 2));

    const card = document.createElement("div");
    const walkFrames = getCatWalkFrames(catType);
    const walkDirectionClass = spotIndex === 0 ? "walk-from-left" : spotIndex === 1 ? "walk-from-top" : "walk-from-right";
    card.classList.add("cat-card", "active-guest", "is-walking-in", walkDirectionClass);
    card.innerHTML = `
        <div class="speech-bubble">
            <span class="order-emoji">
                <img src="${getDishImagePath(requestedDish)}" onerror="this.outerHTML='<span>${requestedDish.emoji}</span>'" class="order-img">
            </span>
            <span class="order-name">${requestedDish.name}</span>
        </div>
        <div class="cat-avatar cat-walk-avatar${walkFrames ? "" : " cat-walk-fallback"}" style="--cat-color: ${catType.color}; color: ${catType.color}">
            ${walkFrames ? `
                <img src="${walkFrames.first}" class="cat-walk-img cat-walk-img-1" alt="${catType.name} 走路幀 1" onerror="this.closest('.cat-walk-avatar').classList.add('cat-walk-fallback')">
                <img src="${walkFrames.second}" class="cat-walk-img cat-walk-img-2" alt="${catType.name} 走路幀 2" onerror="this.closest('.cat-walk-avatar').classList.add('cat-walk-fallback')">
            ` : ""}
            <span class="cat-emoji-fallback">${catType.emoji}</span>
        </div>
        <div class="cat-name">${catType.name}</div>
        <div class="patience-bar">
            <div class="patience-fill" id="patience-fill-${spotIndex}"></div>
        </div>
    `;

    spotNode.appendChild(card);
    animateGuestCard(card);
    setTimeout(() => {
        card.classList.remove("is-walking-in");
        card.classList.add("has-entered");
    }, 1400);

    if (guestObj.timer) clearInterval(guestObj.timer);
    
    guestObj.timer = setInterval(() => {
        if (state.isPaused) return;

        const decreaseSpeed = 1 + (state.level * 0.05);
        guestObj.patience -= (decreaseSpeed * 0.5);

        const fill = document.getElementById(`patience-fill-${spotIndex}`);
        if (fill) {
            const pct = Math.max(0, guestObj.patience);
            fill.style.width = `${pct}%`;

            if (pct > 50) {
                fill.style.backgroundColor = "#2ECC71";
            } else if (pct > 25) {
                fill.style.backgroundColor = "#F1C40F";
            } else {
                fill.style.backgroundColor = "#E74C3C";
                card.classList.add("patience-warning");
            }
        }

        if (guestObj.patience <= 0) {
            clearInterval(guestObj.timer);
            handleGuestLeaveAngry(spotIndex);
        }
    }, 500);
}

function animateGuestCard(card) {
    if (typeof gsap === "undefined") return;

    const bubble = card.querySelector(".speech-bubble");
    const enterFrom = card.classList.contains("walk-from-left")
        ? { x: -120, y: 0 }
        : card.classList.contains("walk-from-right")
            ? { x: 120, y: 0 }
            : { x: 0, y: -90 };

    gsap.fromTo(card,
        { ...enterFrom, opacity: 0, scale: 0.94 },
        { x: 0, y: 0, opacity: 1, scale: 1, duration: 0.72, ease: "power2.out" }
    );

    if (bubble) {
        gsap.fromTo(bubble,
            { y: 8, opacity: 0 },
            { y: 0, opacity: 1, delay: 0.12, duration: 0.36, ease: "back.out(1.8)" }
        );
    }
}

function handleGuestLeaveAngry(spotIndex) {
    const guestObj = state.guests[spotIndex];
    if (!guestObj.active) return;

    guestObj.active = false;
    const spotNode = document.getElementById(`spot-${spotIndex}`);
    const card = spotNode.querySelector(".cat-card");

    gsap.to(card, {
        x: -250,
        opacity: 0,
        duration: 0.6,
        ease: "power2.in",
        onComplete: () => {
            spotNode.innerHTML = "";
            
            if (state.isEndless) {
                state.hearts--;
                SFX.playBurnt();
                updateHUD();
                if (state.hearts <= 0) {
                    triggerGameOver();
                    return;
                }
            } else {
                state.gold = Math.max(0, state.gold - 100);
                SFX.playBurnt();
                updateHUD();
                updateAllIngredientBoxes();
            }

            setTimeout(() => {
                seatRandomCat(spotIndex);
            }, 1500 + Math.random() * 1500);
        }
    });
}

// ==========================================================================
// 6. GSAP & Draggable 物理拖曳核心 (重新實作食材拖放與成品盤出餐)
// ==========================================================================

// 食材拖放邏輯：直接使 Shelf Box 作為 Draggable，並在原地生成靜態 placeholder
function getKitchenDropTargets() {
    return [
        { node: document.querySelector(".sushi-station"), station: "sushi" },
        { node: document.querySelector(".onigiri-station"), station: "onigiri" },
        { node: document.querySelector(".prep-station"), station: "assembly" },
        { node: document.getElementById("prep-pot"), station: "stove" },
        { node: document.querySelector(".oven-station"), station: "oven" }
    ].filter(target => target.node);
}

function setupIngredientDraggable(element) {
    const ingId = element.dataset.id;

    Draggable.create(element, {
        type: "x,y",
        ignore: ".restock-btn",
        onDragStart: function(e) {
            if (state.isPaused || (state.ingredientStock[ingId] || 0) <= 0 || state.restockingId) {
                this.endDrag(e);
                return;
            }
            SFX.playClick();
            element.classList.add("is-dragging");
            
            // 創建視覺備份 Placeholder，採用絕對定位 (position: absolute) 疊加，避免破壞 CSS Grid 排版流向造成物件位移
            const placeholder = element.cloneNode(true);
            placeholder.classList.add("placeholder-box");
            placeholder.style.position = "absolute";
            placeholder.style.left = `${element.offsetLeft}px`;
            placeholder.style.top = `${element.offsetTop}px`;
            placeholder.style.width = `${element.offsetWidth}px`;
            placeholder.style.height = `${element.offsetHeight}px`;
            placeholder.style.zIndex = "1";
            placeholder.style.pointerEvents = "none";
            placeholder.style.opacity = "0.5";
            
            element.parentNode.appendChild(placeholder); // 使用 appendChild 而非 insertBefore 確保 index 不改變
            this.placeholder = placeholder;
            
            gsap.set(element, { zIndex: 1000 });
            // 當點選或拖曳食材時，食材會迅速縮小
            gsap.to(element, { scale: 0.6, duration: 0.15 });
        },
        onDrag: function() {
            checkDragOverPotAndTrash(element);
        },
        onDragEnd: function() {
            const trash = document.getElementById("trash-can");
            element.classList.remove("is-dragging");

            getKitchenDropTargets().forEach(target => target.node.classList.remove("drag-over"));
            trash.classList.remove("drag-over");

            // 清理 Placeholder
            if (this.placeholder) {
                this.placeholder.remove();
            }

            let targetHit = false;

            // 1. 丟入垃圾桶
            if (isCollide(element, trash)) {
                SFX.playClick();
                triggerSmokePuff(this.pointerX, this.pointerY);
                targetHit = true;
            } 
            // 2. 丟入指定工作站
            else {
                const matchedTarget = getKitchenDropTargets().find(target => isCollide(element, target.node));
                if (matchedTarget && !state.isCooking) {
                    targetHit = true;
                    state.ingredientStock[ingId] = Math.max(0, (state.ingredientStock[ingId] || 0) - 1);
                    if (matchedTarget.station === "sushi" || matchedTarget.station === "onigiri") {
                        handleMoldDrop(ingId, matchedTarget.station);
                    } else {
                        addIngredientToPrep(ingId, matchedTarget.station);
                    }
                    updateIngredientBox(ingId);
                }
            }

            // 歸位與縮小回彈
            if (targetHit) {
                gsap.set(element, { x: 0, y: 0, scale: 1, zIndex: 10 });
            } else {
                // 當拖移不成功時，圖片會縮小回彈
                gsap.to(element, {
                    x: 0,
                    y: 0,
                    scale: 0.6,
                    zIndex: 10,
                    duration: 0.4,
                    ease: "power2.out",
                    onComplete: () => {
                        gsap.to(element, { scale: 1, duration: 0.15 });
                    }
                });
            }
        }
    });
}

function checkDragOverPotAndTrash(element) {
    const trash = document.getElementById("trash-can");

    getKitchenDropTargets().forEach(target => {
        if (isCollide(element, target.node)) {
            target.node.classList.add("drag-over");
        } else {
            target.node.classList.remove("drag-over");
        }
    });

    if (isCollide(element, trash)) {
        trash.classList.add("drag-over");
    } else {
        trash.classList.remove("drag-over");
    }
}

// ==========================================================================
// 7. 料理調配合成邏輯與出餐
// ==========================================================================

function handleMoldDrop(ingId, station) {
    const moldImg = document.getElementById(station === "sushi" ? "sushi-mold-img" : "onigiri-mold-img");
    const filledSrc = station === "sushi" ? "assets/equipment/sushi_mold_filled.png" : "assets/equipment/onigiri_filled.png";
    const emptySrc = station === "sushi" ? "assets/equipment/sushi_mold_empty.png" : "assets/equipment/onigiri_empty.png";

    if (ingId !== "rice") {
        if (moldImg) moldImg.src = emptySrc;
        makeBurntDish();
        return;
    }

    if (moldImg) moldImg.src = filledSrc;
    state.isCooking = true;
    showCookingTimer(2, () => {
        if (moldImg) moldImg.src = emptySrc;
        state.isCooking = false;
        addIngredientToPrep(station === "sushi" ? "sushi_rice" : "onigiri_rice", "assembly");
    }, getStationNode(station));
}

function getRecipeMatchStatus(steps, station) {
    const exact = RECIPE_LIST.filter(recipe =>
        recipe.station === station &&
        recipe.steps.length === steps.length &&
        recipe.steps.every((step, index) => step === steps[index])
    );
    const prefix = RECIPE_LIST.filter(recipe =>
        recipe.station === station &&
        recipe.steps.length > steps.length &&
        steps.every((step, index) => recipe.steps[index] === step)
    );

    return { exact, prefix };
}

function addIngredientToPrep(ingId, station) {
    if (state.pendingCookTimer) {
        clearTimeout(state.pendingCookTimer);
        state.pendingCookTimer = null;
    }

    if (!state.prepStation) {
        state.prepStation = station;
    }

    if (state.prepStation !== station) {
        state.potSlots = [];
        state.prepStation = station;
    }

    state.potSlots.push(ingId);
    SFX.playSizzle();
    updatePotSlotsUI();

    const { exact, prefix } = getRecipeMatchStatus(state.potSlots, state.prepStation);

    if (exact.length > 0 && prefix.length === 0) {
        if (station === "stove" || station === "oven") {
            placeEquipmentItem(exact[0], station);
        } else {
            synthesizeDish(exact[0]);
        }
        return;
    }

    if (exact.length > 0 && prefix.length > 0) {
        const hint = document.createElement("div");
        hint.className = "prep-hint";
        hint.innerText = "可繼續加料，或等下一步完成更進階料理";
        document.getElementById("prep-pot").appendChild(hint);
        setTimeout(() => hint.remove(), 900);
        const snapshot = state.potSlots.join("+");
        state.pendingCookTimer = setTimeout(() => {
            if (!state.isCooking && state.potSlots.join("+") === snapshot && exact[0]) {
                if (station === "stove" || station === "oven") {
                    placeEquipmentItem(exact[0], station);
                } else {
                    synthesizeDish(exact[0]);
                }
            }
        }, 1200);
        return;
    }

    if (prefix.length === 0) {
        synthesizeDish(null);
    }
}

function updatePotSlotsUI() {
    const slots = document.getElementById("pot-slots");
    slots.innerHTML = "";
    updatePrepStagePreview();
    updateCompactPrepStatus();

    const shownSlots = Math.max(5, state.potSlots.length);
    for (let i = 0; i < shownSlots; i++) {
        const slot = document.createElement("div");
        slot.classList.add("pot-slot");
        slot.id = `pot-slot-${i + 1}`;

        const ing = state.potSlots[i] ? getItemMeta(state.potSlots[i]) : null;
        if (ing) {
            slot.innerHTML = `
                <img src="${getIngredientImagePath(ing.id)}" onerror="this.outerHTML='<span>${ing.emoji}</span>'" class="ingredient-img-slot">
                <span class="mobile-slot-name">${ing.name}</span>
            `;
        }

        slots.appendChild(slot);
    }
}

function updateCompactPrepStatus() {
    const status = document.getElementById("compact-prep-status");
    if (!status) return;

    const ingredientNames = state.potSlots.map(id => getItemMeta(id).name);
    status.innerText = ingredientNames.length
        ? `食材：${ingredientNames.join("、")}`
        : "拖曳食材到這裡";
}

function updatePrepStagePreview() {
    const preview = document.getElementById("prep-stage-preview");
    if (!preview) return;

    const imgPath = getPrepStageImagePath();
    if (!imgPath) {
        preview.innerHTML = "";
        return;
    }

    preview.innerHTML = `<img src="${imgPath}" alt="製作中料理" class="prep-stage-img">`;
}

function getStationName(station) {
    return {
        sushi: "壽司模具",
        onigiri: "飯糰模具",
        assembly: "出餐準備區",
        stove: "瓦斯爐",
        oven: "烤箱"
    }[station] || "工作區";
}

function clearCurrentPrepState() {
    if (state.pendingCookTimer) {
        clearTimeout(state.pendingCookTimer);
        state.pendingCookTimer = null;
    }
    state.potSlots = [];
    state.prepStation = null;
    state.isCooking = false;
    document.querySelectorAll(".cooking-timer").forEach(timer => timer.remove());
    updatePotSlotsUI();
    updatePrepStagePreview();
}

function synthesizeDish(recipe) {
    const pot = document.getElementById("prep-pot");
    const potRect = pot.getBoundingClientRect();
    triggerSmokePuff(potRect.left + potRect.width / 2, potRect.top + potRect.height / 2);

    if (!recipe) {
        if (state.pendingCookTimer) {
            clearTimeout(state.pendingCookTimer);
            state.pendingCookTimer = null;
        }
        state.potSlots = [];
        state.prepStation = null;
        updatePotSlotsUI();
        updatePrepStagePreview();
        makeBurntDish();
        return;
    }

    state.isCooking = true;
    const waitSeconds = recipe.time || 0;

    const finishCooking = () => {
        state.potSlots = [];
        state.prepStation = null;
        state.isCooking = false;
        state.pendingCookTimer = null;
        updatePotSlotsUI();
        updatePrepStagePreview();
        state.completedDish = { ...recipe, isBurnt: false };
        SFX.playSuccess();
        renderCompletedDishUI();
        startCompletedDishBurnTimer(recipe.station === "stove" || recipe.station === "oven");
    };

    if (waitSeconds <= 0) {
        finishCooking();
        return;
    }

    showCookingTimer(waitSeconds, finishCooking);
}

function makeBurntDish() {
    if (state.completedDishBurnTimer) {
        clearTimeout(state.completedDishBurnTimer);
        state.completedDishBurnTimer = null;
    }
    state.completedDish = { id: "burnt_slop", name: "焦黑失敗料理", emoji: "💀", image: "assets/equipment/burnt.png", isBurnt: true };
    SFX.playBurnt();
    renderCompletedDishUI();
}

function startCompletedDishBurnTimer(shouldBurn) {
    if (state.completedDishBurnTimer) {
        clearTimeout(state.completedDishBurnTimer);
        state.completedDishBurnTimer = null;
    }
    if (!shouldBurn) return;

    state.completedDishBurnTimer = setTimeout(() => {
        if (state.completedDish && !state.completedDish.isBurnt) {
            makeBurntDish();
        }
    }, 15000);
}

function placeEquipmentItem(recipe, station) {
    state.potSlots = [];
    state.prepStation = null;
    updatePotSlotsUI();
    updatePrepStagePreview();

    if (station === "stove") {
        const burnerKey = !state.equipment.stoveLeft.hasItem ? "stoveLeft" : (!state.equipment.stoveRight.hasItem ? "stoveRight" : "stoveLeft");
        state.equipment[burnerKey] = {
            hasItem: true,
            recipe,
            running: false,
            fireOn: false,
            kind: getStoveRecipeKind(recipe)
        };
        updateStoveImages();
        return;
    }

    if (station === "oven") {
        state.equipment.oven = { hasItem: true, recipe, running: false, closed: false };
        updateOvenImage();
    }
}

function getStoveRecipeKind(recipe) {
    if (recipe.id.includes("soup")) return "soup";
    if (recipe.id === "cheese_shrimp_rice") return "fried_rice";
    return "risotto";
}

function getStoveImage(kind, running) {
    if (!kind) return running ? "assets/equipment/stove_on.png" : "assets/equipment/stove_off.png";
    const suffix = running ? "on" : "off";
    return `assets/equipment/stove_${kind}_${suffix}.png`;
}

function updateStoveImages() {
    const left = document.getElementById("stove-left-img");
    const right = document.getElementById("stove-right-img");
    if (left) {
        const eq = state.equipment.stoveLeft;
        left.src = eq.hasItem ? getStoveImage(eq.kind, eq.running) : getStoveImage(null, eq.fireOn);
    }
    if (right) {
        const eq = state.equipment.stoveRight;
        right.src = eq.hasItem ? getStoveImage(eq.kind, eq.running) : getStoveImage(null, eq.fireOn);
    }
    updateCompactEquipmentControls();
}

function updateOvenImage() {
    const oven = document.getElementById("oven-img");
    if (!oven) return;
    const eq = state.equipment.oven;
    if (eq.hasItem && eq.running) oven.src = "assets/equipment/oven_closed_working.png";
    else if (eq.hasItem) oven.src = "assets/equipment/oven_open_working.png";
    else oven.src = eq.closed ? "assets/equipment/oven_closed.png" : "assets/equipment/oven_open.png";

    if (eq.hasItem && eq.running) setOvenStatus("烘烤中");
    else if (eq.hasItem) setOvenStatus("點擊烤箱開始");
    else setOvenStatus(eq.closed ? "烤箱已關閉" : "烤箱閒置中");
    updateCompactEquipmentControls();
}

function setOvenStatus(text) {
    const status = document.getElementById("oven-status");
    if (status) status.innerText = text;
}

function updateCompactEquipmentControls() {
    const setStoveText = (id, label, equipment) => {
        const button = document.getElementById(id);
        if (!button) return;
        let status = equipment.running
            ? "烹飪中"
            : equipment.hasItem
                ? "準備烹飪"
                : equipment.fireOn ? "開" : "關";
        button.innerHTML = `
            <span class="compact-stove-label">${label}</span>
            <span class="compact-stove-status">目前狀態：${status}</span>
        `;
    };

    setStoveText("compact-stove-left", "左爐", state.equipment.stoveLeft);
    setStoveText("compact-stove-right", "右爐", state.equipment.stoveRight);

    const ovenButton = document.getElementById("compact-oven-button");
    const oven = state.equipment.oven;
    if (ovenButton) {
        if (oven.running) ovenButton.innerText = "烤箱：烘烤中";
        else if (oven.hasItem) ovenButton.innerText = "烤箱：開始烘烤";
        else ovenButton.innerText = `烤箱：${oven.closed ? "開門" : "關門"}`;
    }
}

function toggleStoveBurner(key) {
    const eq = state.equipment[key];
    if (!eq.hasItem) {
        eq.fireOn = !eq.fireOn;
        updateStoveImages();
        return;
    }
    if (eq.running) return;
    eq.running = true;
    updateStoveImages();
    showCookingTimer(5, () => {
        const finished = eq.recipe;
        state.equipment[key] = { hasItem: false, recipe: null, running: false, fireOn: false, kind: null };
        updateStoveImages();
        state.completedDish = { ...finished, isBurnt: false };
        SFX.playSuccess();
        renderCompletedDishUI();
        startCompletedDishBurnTimer(true);
    }, document.getElementById("prep-pot"));
}

function toggleOven() {
    const eq = state.equipment.oven;
    if (!eq.hasItem) {
        eq.closed = !eq.closed;
        updateOvenImage();
        return;
    }
    if (eq.running) return;
    eq.running = true;
    eq.closed = true;
    updateOvenImage();
    let ovenSecondsLeft = 5;
    setOvenStatus(`烘烤中 剩餘 ${ovenSecondsLeft} 秒`);
    const ovenStatusTimer = setInterval(() => {
        if (state.isPaused) return;
        ovenSecondsLeft--;
        setOvenStatus(`烘烤中 剩餘 ${Math.max(0, ovenSecondsLeft)} 秒`);
        if (ovenSecondsLeft <= 0) clearInterval(ovenStatusTimer);
    }, 1000);
    showCookingTimer(5, () => {
        clearInterval(ovenStatusTimer);
        const finished = eq.recipe;
        state.equipment.oven = { hasItem: false, recipe: null, running: false, closed: false };
        updateOvenImage();
        setOvenStatus("完成");
        setTimeout(() => {
            if (!state.equipment.oven.hasItem && !state.equipment.oven.running) updateOvenImage();
        }, 1400);
        state.completedDish = { ...finished, isBurnt: false };
        SFX.playSuccess();
        renderCompletedDishUI();
        startCompletedDishBurnTimer(true);
    }, document.querySelector(".oven-station"));
}

function showCookingTimer(seconds, onComplete, targetNode = null) {
    const pot = targetNode || getStationNode(state.prepStation) || document.getElementById("prep-pot");
    const timer = document.createElement("div");
    timer.className = "cooking-timer";
    timer.innerHTML = `<div class="timer-ring"></div><span>${seconds}</span>`;
    pot.appendChild(timer);

    let left = seconds;
    const interval = setInterval(() => {
        if (state.isPaused) return;
        left--;
        const span = timer.querySelector("span");
        if (span) span.innerText = left;

        if (left <= 0) {
            clearInterval(interval);
            timer.remove();
            onComplete();
        }
    }, 1000);
}

function getStationNode(station) {
    return {
        sushi: document.querySelector(".sushi-station"),
        onigiri: document.querySelector(".onigiri-station"),
        assembly: document.querySelector(".prep-station"),
        stove: document.getElementById("prep-pot"),
        oven: document.querySelector(".oven-station")
    }[station] || null;
}

function renderCompletedDishUI() {
    const container = document.getElementById("completed-dish-slot");
    container.innerHTML = "";

    if (!state.completedDish) return;

    const dish = document.createElement("div");
    dish.classList.add("completed-dish");
    dish.innerHTML = `
        <div class="dish-icon">
            <img src="${getDishImagePath(state.completedDish)}" onerror="this.outerHTML='<span>${state.completedDish.emoji}</span>'" class="dish-img">
        </div>
        <div class="dish-label">${state.completedDish.name}</div>
    `;

    container.appendChild(dish);
    animateCompletedDish(dish, state.completedDish);

    // 成品盤料理直接綁定 Draggable 拖曳，修復原先 cursor clone 的手感與衝突
    setupDishDraggable(dish);
}

// 重新實作成品盤料理拖曳出餐
function animateCompletedDish(dishNode, dishData) {
    if (typeof gsap !== "undefined") {
        gsap.fromTo(dishNode,
            { y: 18, opacity: 0, scale: 0.72, rotate: -4 },
            { y: 0, opacity: 1, scale: 1, rotate: 0, duration: 0.45, ease: "back.out(1.8)" }
        );
    }

    if (!dishData || dishData.isBurnt) return;

    const rect = dishNode.getBoundingClientRect();
    triggerParticleBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function setupDishDraggable(element) {
    Draggable.create(element, {
        type: "x,y",
        onDragStart: function(e) {
            if (state.isPaused) {
                this.endDrag(e);
                return;
            }
            SFX.playClick();
            element.classList.add("is-dragging");
            gsap.set(element, { zIndex: 1000 });
            // 當點選或拖曳完成的食物時，圖片會迅速縮小 0.6 倍，提供精緻的點擊反饋
            gsap.to(element, { scale: 0.6, duration: 0.15 });
        },
        onDrag: function() {
            checkDishDragOver(element);
        },
        onDragEnd: function() {
            const trash = document.getElementById("trash-can");
            element.classList.remove("is-dragging");
            trash.classList.remove("drag-over");

            // 移除貓咪客席的所有碰撞高光
            for (let i = 0; i < 3; i++) {
                const spotNode = document.getElementById(`spot-${i}`);
                const card = spotNode.querySelector(".cat-card");
                if (card) {
                    card.style.transform = "scale(1)";
                    card.style.borderColor = "";
                }
            }

            let dishServed = false;

            // 1. 垃圾桶銷毀成品
            if (isCollide(element, trash)) {
                SFX.playClick();
                triggerSmokePuff(this.pointerX, this.pointerY);
                state.completedDish = null;
                if (state.completedDishBurnTimer) clearTimeout(state.completedDishBurnTimer);
                state.completedDishBurnTimer = null;
                renderCompletedDishUI();
                return;
            }

            // 2. 檢測 3 個客席貓咪碰撞
            for (let i = 0; i < 3; i++) {
                const spotNode = document.getElementById(`spot-${i}`);
                const card = spotNode.querySelector(".cat-card");
                const guestObj = state.guests[i];

                if (card && isCollide(element, card) && guestObj.active) {
                    const dish = state.completedDish;

                    if (dish.isBurnt) {
                        guestObj.patience = Math.max(0, guestObj.patience * 0.5);
                        SFX.playBurnt();
                        gsap.to(card, {
                            x: 10, repeat: 5, yoyo: true, duration: 0.05,
                            onComplete: () => { card.style.transform = "none"; }
                        });
                        dishServed = true;
                    } else if (dish.id === guestObj.order.id) {
                        serveCorrectDish(i, card);
                        dishServed = true;
                    } else {
                        // 送錯東西給貓咪，耐心扣除 20%
                        guestObj.patience = Math.max(0, guestObj.patience - 20);
                        SFX.playBurnt(); // 播放失望效果音
                        
                        gsap.to(card, {
                            x: 10, repeat: 3, yoyo: true, duration: 0.08, // 搖頭表示拒絕
                            onComplete: () => { card.style.transform = "none"; }
                        });
                    }
                    break;
                }
            }

            if (dishServed) {
                state.completedDish = null;
                if (state.completedDishBurnTimer) clearTimeout(state.completedDishBurnTimer);
                state.completedDishBurnTimer = null;
                renderCompletedDishUI();
            } else {
                // 當一次拖移不成功或僅是點選放開時，圖片會縮小回彈
                gsap.to(element, {
                    x: 0,
                    y: 0,
                    scale: 0.6,
                    zIndex: 20,
                    duration: 0.4,
                    ease: "power2.out",
                    onComplete: () => {
                        gsap.to(element, { scale: 1, duration: 0.15 });
                    }
                });
            }
        }
    });
}

function checkDishDragOver(element) {
    const trash = document.getElementById("trash-can");
    if (isCollide(element, trash)) {
        trash.classList.add("drag-over");
    } else {
        trash.classList.remove("drag-over");
    }

    for (let i = 0; i < 3; i++) {
        const spotNode = document.getElementById(`spot-${i}`);
        const card = spotNode.querySelector(".cat-card");
        if (card && isCollide(element, card)) {
            card.style.transform = "scale(1.06)";
            card.style.borderColor = "var(--primary-color)";
        } else if (card) {
            card.style.transform = "scale(1)";
            card.style.borderColor = "";
        }
    }
}

function serveCorrectDish(spotIndex, catCardNode) {
    const guestObj = state.guests[spotIndex];
    clearInterval(guestObj.timer);
    guestObj.active = false;

    SFX.playSuccess();

    // 基礎金幣與經驗值
    let baseGold = 100;
    let baseExp = 50;

    // 若等級大於 6，送餐成功的經驗值與金幣翻倍
    if (state.level > 6) {
        baseGold = 200;
        baseExp = 100;
    }

    const goldGained = state.isFever ? (baseGold * 2) : baseGold;
    state.gold += goldGained;
    addExp(baseExp);
    updateAllIngredientBoxes();

    triggerGoldFloatText(catCardNode, `+${goldGained} 🪙`);
    const cardRect = catCardNode.getBoundingClientRect();
    triggerParticleBurst(cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 2, ["#ff7b54", "#ffd166", "#6abd3f"]);

    gsap.to(catCardNode, {
        y: -30,
        scale: 1.1,
        duration: 0.2,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
            gsap.to(catCardNode, {
                x: 250,
                opacity: 0,
                duration: 0.4,
                ease: "power2.in",
                onComplete: () => {
                    const spot = document.getElementById(`spot-${spotIndex}`);
                    spot.innerHTML = "";
                    setTimeout(() => {
                        seatRandomCat(spotIndex);
                    }, 1500);
                }
            });
        }
    });
}

function triggerGoldFloatText(cardNode, text) {
    const rect = cardNode.getBoundingClientRect();
    const floating = document.createElement("div");
    floating.style.position = "fixed";
    floating.style.left = `${rect.left + rect.width / 2 - 20}px`;
    floating.style.top = `${rect.top}px`;
    floating.style.color = "var(--primary-color)";
    floating.style.fontWeight = "bold";
    floating.style.fontSize = "1.5rem";
    floating.style.pointerEvents = "none";
    floating.style.zIndex = "999";
    floating.innerText = text;
    document.body.appendChild(floating);

    gsap.to(floating, {
        y: -80,
        opacity: 0,
        duration: 1.2,
        onComplete: () => floating.remove()
    });
}

// ==========================================================================
// 8. Anime.js 精緻微型特效
// ==========================================================================

function triggerConfettiEffect() {
    const canvas = document.getElementById("confetti-canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#FF7B54", "#FFD1C1", "#FFE4D6", "#2ECC71", "#3498DB", "#F1C40F"];
    const particles = [];

    for (let i = 0; i < 75; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * -100,
            r: Math.random() * 6 + 4,
            d: Math.random() * canvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 5,
            tiltAngleIncremental: Math.random() * 0.07 + 0.02,
            tiltAngle: 0
        });
    }

    let animationFrameId;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let finished = true;

        particles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            // 增加重力下落速度與擺幅，讓彩帶下落更生動、更具動感，並保證在 3 秒內安全落出螢幕
            p.y += (Math.cos(p.tiltAngle) + 4 + p.r) * 0.65;
            p.x += Math.sin(p.tiltAngle) * 1.5;
            p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 15;

            if (p.y <= canvas.height) finished = false;

            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            ctx.stroke();
        });

        if (!finished) {
            animationFrameId = requestAnimationFrame(draw);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    draw();
    // 4 秒後強制停止 requestAnimationFrame 渲染並清空畫布，徹底解決彩帶殘留在畫面上不消失的 Bug
    setTimeout(() => {
        cancelAnimationFrame(animationFrameId);
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, 4000);
}

function triggerParticleBurst(x, y, colors = ["#ff7b54", "#ffd166", "#6abd3f", "#ffb199"]) {
    if (typeof anime === "undefined") return;

    const count = 18;
    const particles = [];
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "fx-particle";
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.color = colors[i % colors.length];
        p.style.background = "currentColor";
        document.body.appendChild(p);
        particles.push(p);
    }

    anime({
        targets: particles,
        translateX: () => anime.random(-72, 72),
        translateY: () => anime.random(-90, 38),
        scale: [1.25, 0],
        opacity: [1, 0],
        rotate: () => anime.random(-180, 180),
        delay: anime.stagger(12),
        duration: 760,
        easing: "easeOutExpo",
        complete: () => particles.forEach(p => p.remove())
    });
}

function triggerSmokePuff(x, y) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.pointerEvents = "none";
    container.style.zIndex = "999";
    document.body.appendChild(container);

    const count = 12;
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.style.position = "absolute";
        p.style.width = "12px";
        p.style.height = "12px";
        p.style.borderRadius = "50%";
        p.style.background = state.isEndless ? "rgba(214,175,55,0.7)" : "rgba(255,255,255,0.85)";
        p.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
        container.appendChild(p);

        const angle = (i / count) * Math.PI * 2;
        const distance = Math.random() * 40 + 20;

        anime({
            targets: p,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            scale: [1, 0],
            opacity: [1, 0],
            duration: Math.random() * 500 + 400,
            easing: "easeOutQuad"
        });
    }

    setTimeout(() => container.remove(), 1000);
}

// ==========================================================================
// 9. 隨機老鼠干擾事件
// ==========================================================================

function isMobileGameLayout() {
    return window.matchMedia("(max-width: 820px), (max-width: 1024px) and (max-height: 500px) and (orientation: landscape)").matches;
}

function disableMouseForMobile() {
    if (state.mouseInterval) {
        clearInterval(state.mouseInterval);
        state.mouseInterval = null;
    }
    if (state.mouseTimer) {
        clearTimeout(state.mouseTimer);
        state.mouseTimer = null;
    }
    if (state.mouseAnim) {
        state.mouseAnim.pause();
        state.mouseAnim = null;
    }

    state.mouseActive = false;
    const mouse = document.querySelector(".mouse-entity");
    if (mouse) mouse.remove();
    document.getElementById("mouse-siren")?.classList.add("hide");
    document.body.classList.remove("mouse-alert-active");
}

function syncMobileMouseAvailability() {
    if (isMobileGameLayout()) {
        disableMouseForMobile();
    } else if (state.gameStarted && !state.mouseInterval) {
        startMouseSpawnScheduler();
    }
}

function startMouseSpawnScheduler() {
    if (isMobileGameLayout()) {
        disableMouseForMobile();
        return;
    }

    state.mouseInterval = setInterval(() => {
        if (state.isPaused || state.mouseActive || !state.gameStarted) return;
        
        if (Math.random() > 0.5) {
            spawnMouseAttack();
        }
    }, 15000);
}

function spawnMouseAttack() {
    if (isMobileGameLayout()) {
        disableMouseForMobile();
        return;
    }

    state.mouseActive = true;
    state.mouseClicks = 0; // 初始化點擊次數為 0
    SFX.playAlert();
    
    const alarm = document.getElementById("mouse-siren");
    alarm.classList.remove("hide");
    document.body.classList.add("mouse-alert-active");

    const zone = document.getElementById("mouse-zone");
    zone.innerHTML = "";

    const mouse = document.createElement("div");
    mouse.classList.add("mouse-entity");
    // 老鼠元件：包含可愛老鼠與 HP 血量文字
    mouse.innerHTML = `
        <span class="mouse-icon">🐭</span>
        <span class="mouse-hp">❤️3</span>
    `;
    const zoneWidth = zone.clientWidth || window.innerWidth;
    const zoneHeight = zone.clientHeight || Math.max(360, window.innerHeight - 92);
    const maxX = Math.max(260, zoneWidth - 92);
    const maxY = Math.max(240, zoneHeight - 96);
    const startX = Math.random() > 0.5 ? 8 : maxX;
    const startY = Math.round(20 + Math.random() * (maxY - 40));

    mouse.style.left = `${startX}px`;
    mouse.style.top = `${startY}px`;
    mouse.style.display = "flex";
    mouse.style.flexDirection = "column";
    mouse.style.alignItems = "center";
    mouse.style.position = "absolute";
    mouse.style.pointerEvents = "auto";
    zone.appendChild(mouse);

    // 點擊判定：點擊固定 3 次老鼠才消失，且消失後不可再點擊
    const handleMouseClick = (e) => {
        if (state.isPaused || !state.mouseActive) return;
        
        state.mouseClicks++;
        SFX.playSqueak();
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        triggerSmokePuff(clientX, clientY);

        // 浮動提示擊打次數
        triggerGoldFloatText(mouse, `💥 ${state.mouseClicks}/3`);

        // 更新老鼠血量文字
        const hpText = mouse.querySelector(".mouse-hp");
        if (hpText) {
            hpText.innerText = `❤️${3 - state.mouseClicks}`;
        }

        if (state.mouseClicks >= 3) {
            // 點擊滿 3 次，立刻禁用點擊防止玩家再次點到！
            mouse.style.pointerEvents = "none";
            handleMouseDefeated(mouse, alarm, clientX, clientY);
        } else {
            // 未滿 3 次，點擊時做縮放彈跳
            gsap.fromTo(mouse, { scale: 1.3 }, { scale: 1, duration: 0.15 });
        }
    };

    mouse.addEventListener("mousedown", handleMouseClick);
    mouse.addEventListener("touchstart", (e) => {
        e.preventDefault();
        handleMouseClick(e);
    });

    // 讓老鼠在整個遊戲畫面亂跑，不再只侷限在最下方。
    state.mouseAnim = anime({
        targets: mouse,
        left: [
            startX,
            Math.round(Math.random() * maxX),
            startX === 8 ? maxX : 8,
            Math.round(Math.random() * maxX)
        ],
        top: [
            startY,
            Math.round(Math.random() * maxY),
            Math.round(Math.random() * maxY),
            Math.round(Math.random() * maxY)
        ],
        duration: 10400,
        easing: "easeInOutSine",
        direction: "alternate",
        loop: true
    });

    // 8 秒偷竊定時器：若 8 秒內沒被點滿 3 次，老鼠會跑去偷取東西
    if (state.mouseTimer) clearTimeout(state.mouseTimer);
    state.mouseTimer = setTimeout(() => {
        if (state.mouseActive && state.gameStarted) {
            // 停止折返跑動，進入衝刺偷竊
            anime.remove(mouse);
            if (state.mouseAnim) {
                state.mouseAnim.pause();
                state.mouseAnim = null;
            }
            
            let targetElement = document.querySelector(".completed-dish");
            let targetType = "completed_dish";
            let targetId = null;

            if (!targetElement) {
                const unlockedBox = document.querySelectorAll(".ingredient-box:not(.locked)");
                if (unlockedBox.length > 0) {
                    targetElement = unlockedBox[Math.floor(Math.random() * unlockedBox.length)];
                    targetType = "pantry_ingredient";
                    targetId = targetElement.dataset.id || null;
                } else {
                    targetType = "gold";
                }
            }

            let endX = window.innerWidth - 120;
            let endY = Math.max(20, Math.round(maxY * 0.5));
            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                endX = rect.left;
                endY = Math.max(10, rect.top - zone.getBoundingClientRect().top);
            }

            mouse.style.pointerEvents = "none"; // 偷竊時無法再點選

            anime({
                targets: mouse,
                left: endX,
                top: endY,
                duration: 2000,
                easing: "easeOutQuad",
                complete: () => {
                    handleMouseStealSuccess(mouse, alarm, targetType, targetId);
                }
            });
        }
    }, 8000);
}

function handleMouseDefeated(mouseNode, alarmNode, clickX, clickY) {
    state.mouseActive = false;
    if (state.mouseTimer) {
        clearTimeout(state.mouseTimer);
        state.mouseTimer = null;
    }
    if (state.mouseAnim) {
        state.mouseAnim.pause();
        state.mouseAnim = null;
    }
    if (state.pendingCookTimer) clearTimeout(state.pendingCookTimer);
    state.pendingCookTimer = null;
    if (state.completedDishBurnTimer) clearTimeout(state.completedDishBurnTimer);
    state.completedDishBurnTimer = null;
    anime.remove(mouseNode);
    
    SFX.playSqueak();
    triggerSmokePuff(clickX, clickY);

    alarmNode.classList.add("hide");
    document.body.classList.remove("mouse-alert-active");

    // 受驚縮小高飛，以極快速度逃離舞台
    anime({
        targets: mouseNode,
        y: 100,
        scale: [1, 0.1],
        opacity: [1, 0],
        duration: 450,
        easing: "easeInQuad",
        complete: () => {
            mouseNode.remove();
        }
    });
}

function handleMouseStealSuccess(mouseNode, alarmNode, targetType, targetId = null) {
    state.mouseActive = false;
    state.mouseAnim = null;
    if (state.mouseTimer) {
        clearTimeout(state.mouseTimer);
        state.mouseTimer = null;
    }
    alarmNode.classList.add("hide");
    document.body.classList.remove("mouse-alert-active");

    if (targetType === "completed_dish" && state.completedDish) {
        state.completedDish = null;
        renderCompletedDishUI();
        triggerMouseSpeech(mouseNode, "偷走美食嚕！🤪");
    } else if (targetType === "pantry_ingredient") {
        if (targetId && typeof state.ingredientStock[targetId] === "number") {
            state.ingredientStock[targetId] = Math.max(0, state.ingredientStock[targetId] - 1);
        }
        clearCurrentPrepState();
        if (targetId) updateIngredientBox(targetId);
        triggerMouseSpeech(mouseNode, "食材被偷走了！");
    } else if (targetType === "ingredient") {
        clearCurrentPrepState();
        triggerMouseSpeech(mouseNode, "食材歸我了！😎");
    } else {
        state.gold = Math.max(0, state.gold - 50);
        updateHUD();
        updateAllIngredientBoxes();
        triggerMouseSpeech(mouseNode, "搶走金幣 50 🪙！");
    }

    anime({
        targets: mouseNode,
        x: window.innerWidth + 100,
        scale: 1.3,
        duration: 1600,
        easing: "easeInQuad",
        complete: () => {
            mouseNode.remove();
        }
    });
}

function triggerMouseSpeech(mouseNode, text) {
    const bubble = document.createElement("div");
    bubble.innerText = text;
    bubble.style.position = "fixed";
    bubble.style.background = "#fff";
    bubble.style.border = "2px solid #e74c3c";
    bubble.style.borderRadius = "8px";
    bubble.style.padding = "4px 8px";
    bubble.style.fontSize = "0.75rem";
    bubble.style.fontWeight = "bold";
    bubble.style.color = "#e74c3c";
    bubble.style.pointerEvents = "none";
    bubble.style.zIndex = "999";

    const rect = mouseNode.getBoundingClientRect();
    bubble.style.left = `${rect.left}px`;
    bubble.style.top = `${rect.top - 25}px`;

    document.body.appendChild(bubble);

    gsap.to(bubble, {
        y: -40,
        opacity: 0,
        duration: 1.5,
        onComplete: () => bubble.remove()
    });
}

// ==========================================================================
// 10. 排行榜 & 遊戲結算 (Game Over & LocalStorage)
// ==========================================================================

function triggerGameOver() {
    state.isPaused = true;
    state.gameStarted = false;
    stopSynthesizedBgm();

    saveScoreToLocalStorage(state.gold);

    const overlay = document.getElementById("gameover-overlay");
    document.getElementById("final-score-val").innerText = state.gold;
    overlay.classList.add("active");

    renderLeaderboard();
}

function saveScoreToLocalStorage(score) {
    const scores = JSON.parse(localStorage.getItem("cat_chef_scores") || "[]");
    const newRecord = {
        date: new Date().toLocaleString("zh-TW", { hour12: false }),
        score: score
    };
    scores.push(newRecord);
    
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem("cat_chef_scores", JSON.stringify(scores.slice(0, 5)));
}

function renderLeaderboard() {
    const body = document.getElementById("leaderboard-body");
    body.innerHTML = "";

    const scores = JSON.parse(localStorage.getItem("cat_chef_scores") || "[]");
    if (scores.length === 0) {
        body.innerHTML = `<tr><td colspan="3">暫無大師記錄，快去廚神爭霸吧！</td></tr>`;
        return;
    }

    scores.forEach((record, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${index + 1} 👑</td>
            <td>${record.date}</td>
            <td><strong>${record.score}</strong></td>
        `;
        body.appendChild(tr);
    });
}

// ==========================================================================
// 11. 遊戲生命週期控制與導航欄連動 (Top Navigation Bar Control)
// ==========================================================================

function startGame() {
    initAudio();
    startSynthesizedBgm();

    // 重設狀態
    state.level = 1;
    state.exp = 0;
    state.gold = 0;
    state.hearts = 3;
    state.isPaused = state.orientationLocked;
    state.isFever = false;
    state.isEndless = false;
    state.gameStarted = true;
    state.potSlots = [];
    state.prepStation = null;
    state.isCooking = false;
    if (state.pendingCookTimer) clearTimeout(state.pendingCookTimer);
    state.pendingCookTimer = null;
    if (state.completedDishBurnTimer) clearTimeout(state.completedDishBurnTimer);
    state.completedDishBurnTimer = null;
    state.ingredientStock = {};
    state.restockingId = null;
    state.completedDish = null;
    state.equipment = {
        stoveLeft: { hasItem: false, recipe: null, running: false, fireOn: false, kind: null },
        stoveRight: { hasItem: false, recipe: null, running: false, fireOn: false, kind: null },
        oven: { hasItem: false, recipe: null, running: false, closed: false }
    };

    document.body.classList.remove("michelin-theme");
    document.getElementById("start-screen").classList.remove("active");
    document.getElementById("gameover-overlay").classList.remove("active");
    document.getElementById("book-modal").classList.remove("active");
    document.getElementById("instructions-modal").classList.remove("active");

    // 提亮主畫面
    document.getElementById("game-container").style.opacity = 1;

    // 清空客席
    for (let i = 0; i < 3; i++) {
        if (state.guests[i].timer) clearInterval(state.guests[i].timer);
        state.guests[i] = { active: false, type: null, order: null, patience: 100, timer: null };
        document.getElementById(`spot-${i}`).innerHTML = "";
    }

    // 渲染食材供應架、圖鑑、HUD
    renderIngredientsShelf();
    renderRecipeBook();
    updateHUD();
    updatePotSlotsUI();
    updateStoveImages();
    updateOvenImage();
    const sushiMold = document.getElementById("sushi-mold-img");
    const onigiriMold = document.getElementById("onigiri-mold-img");
    if (sushiMold) sushiMold.src = "assets/equipment/sushi_mold_empty.png";
    if (onigiriMold) onigiriMold.src = "assets/equipment/onigiri_empty.png";

    // 安排 3 個座位的貓咪入座
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            seatRandomCat(i);
        }, i * 1000);
    }

    // 啟動老鼠監聽器
    if (state.mouseInterval) clearInterval(state.mouseInterval);
    startMouseSpawnScheduler();

    // 更新 Navigation Bar 狀態：啟用「進入廚房」高亮
    updateNavActiveTab("nav-btn-start");
}

// 更新 Navigation Bar 高亮標籤
function updateNavActiveTab(activeId) {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        if (item.id === activeId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
}

function isCollide(div1, div2) {
    const rect1 = div1.getBoundingClientRect();
    const rect2 = div2.getBoundingClientRect();

    return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
    );
}

// 暫停所有遊戲時間 (包括客人耐心倒數與老鼠突襲移動)
function pauseGame() {
    state.isPaused = true;
    if (state.mouseAnim) {
        state.mouseAnim.pause();
    }
}

// 恢復所有遊戲時間
function resumeGame() {
    if (state.gameStarted && !state.orientationLocked) {
        state.isPaused = false;
        if (state.mouseAnim) {
            state.mouseAnim.play();
        }
    }
}

function updateOrientationLock() {
    const shouldLock = window.matchMedia("(orientation: portrait) and (max-width: 1024px)").matches;
    const overlay = document.getElementById("orientation-lock");

    if (shouldLock && !state.orientationLocked) {
        state.wasPausedBeforeOrientation = state.isPaused;
        state.orientationLocked = true;
        pauseGame();
    } else if (!shouldLock && state.orientationLocked) {
        state.orientationLocked = false;
        if (!state.wasPausedBeforeOrientation) {
            resumeGame();
        }
        state.wasPausedBeforeOrientation = false;
    }

    document.body.classList.toggle("orientation-locked", shouldLock);
    if (overlay) {
        overlay.setAttribute("aria-hidden", String(!shouldLock));
    }
}

// 退出遊戲回到主選單
function exitToMainMenu() {
    state.gameStarted = false;
    state.isPaused = true;
    stopSynthesizedBgm();

    // 清除老鼠干擾、定時器與動畫，防止殘留
    state.mouseActive = false;
    if (state.mouseTimer) {
        clearTimeout(state.mouseTimer);
        state.mouseTimer = null;
    }
    if (state.mouseAnim) {
        state.mouseAnim.pause();
        state.mouseAnim = null;
    }
    const mouseEl = document.querySelector(".mouse-entity");
    if (mouseEl) mouseEl.remove();
    document.getElementById("mouse-siren").classList.add("hide");
    document.body.classList.remove("mouse-alert-active");

    // 清除定時器
    for (let i = 0; i < 3; i++) {
        if (state.guests[i].timer) clearInterval(state.guests[i].timer);
    }

    document.getElementById("start-screen").classList.add("active");
    document.getElementById("book-modal").classList.remove("active");
    document.getElementById("instructions-modal").classList.remove("active");
    document.getElementById("game-container").style.opacity = 0.2;
    
    updateNavActiveTab("nav-btn-start");
}

// ==========================================================================
// 12. 前置故事開場動畫 (Intro Story Animation)
// ==========================================================================

function playIntroStoryAnimationLegacy() {
    // 防禦性檢查：防範 CDN 載入失敗導致的 JS 崩潰，若庫不存在則優雅跳過直接彈出說明
    if (typeof gsap === "undefined" || typeof anime === "undefined") {
        const instructionsModal = document.getElementById("instructions-modal");
        if (instructionsModal) {
            instructionsModal.classList.add("active");
        }
        const currentOverlay = document.getElementById("intro-story-overlay");
        if (currentOverlay) {
            currentOverlay.remove();
        }
        return;
    }

    initAudio();
    state.isPaused = true;
    
    const overlay = document.getElementById("intro-story-overlay");
    const skipBtn = document.getElementById("skip-intro-btn");
    const subtitleBox = document.getElementById("story-subtitle");
    
    if (!overlay) {
        // 若 overlay 已經被 remove 了，直接進入新手指南
        const instructionsModal = document.getElementById("instructions-modal");
        if (instructionsModal) {
            instructionsModal.classList.add("active");
        }
        return;
    }
    
    // 確保提亮 overlay 顯現
    gsap.set(overlay, { opacity: 1, display: "flex" });

    // 立即將開始選單隱藏，並在背景準備提亮主遊戲畫面，保證動畫結束後直達主遊戲介面而非開始選單
    document.getElementById("start-screen").classList.remove("active");
    document.getElementById("game-container").style.opacity = 1;
    
    let timers = [];
    let animeInstances = [];
    let finished = false;
    
    // 輔助函數：打字機字幕效果
    function typeText(text, duration, onComplete) {
        let current = "";
        let index = 0;
        const intervalTime = duration / text.length;
        subtitleBox.innerText = "";
        const timer = setInterval(() => {
            if (index < text.length) {
                current += text[index];
                subtitleBox.innerText = current;
                index++;
            } else {
                clearInterval(timer);
                if (onComplete) onComplete();
            }
        }, intervalTime);
        return timer;
    }
    
    // 動畫結束清理與新手指南銜接
    function finishIntro() {
        if (finished) return;
        finished = true;
        
        // 1. 停止並清除所有動畫實例與 timer
        if (typeof tl !== "undefined" && tl) {
            tl.kill();
        }
        timers.forEach(t => clearInterval(t));
        animeInstances.forEach(a => {
            if (a) a.pause();
        });
        
        // 額外清理獨立的浮動與強震動畫
        gsap.killTweensOf(".cat-scientist-wrapper");
        gsap.killTweensOf(".black-chef-wrapper");
        gsap.killTweensOf(".tractor-beam");
        gsap.killTweensOf("#intro-story-overlay");
        
        // 2. 徹底移除圖層 DOM，釋放記憶體且防阻點擊
        const currentOverlay = document.getElementById("intro-story-overlay");
        if (currentOverlay) {
            currentOverlay.remove();
        }
        
        // 3. 彈出新手指南模態框
        const instructionsModal = document.getElementById("instructions-modal");
        if (instructionsModal) {
            instructionsModal.classList.add("active");
        }
    }
    
    // 點擊跳過按鈕
    skipBtn.addEventListener("click", () => {
        SFX.playClick();
        finishIntro();
    });
    
    // 初始化 Timeline
    let tl = gsap.timeline({
        onComplete: finishIntro
    });
    
    // 🎬 第一幕 (Act 1)：外太空的飢餓發現
    tl.add(() => {
        document.getElementById("act-1").classList.remove("hide");
        document.getElementById("act-2").classList.add("hide");
        document.getElementById("act-3").classList.add("hide");
        
        gsap.set(".space-bg", { opacity: 0 });
        gsap.set(".cat-scientist-wrapper", { opacity: 0, y: 0 });
        gsap.set(".taiwan-island-wrapper", { opacity: 0, scale: 0.4 });
    });
    
    tl.to([".space-bg", ".cat-scientist-wrapper"], { opacity: 1, duration: 1.5, ease: "power2.out" });
    
    tl.add(() => {
        // 喵王星科學家圖片上下浮動
        gsap.to(".cat-scientist-wrapper", { y: -15, duration: 1.5, repeat: -1, yoyo: true, ease: "power1.inOut" });
        
        // 字幕打出
        let timer = typeText("喵星曆 2026 年，統治者們吃膩了星球上的合成罐頭...", 1500);
        timers.push(timer);
    });
    
    tl.to({}, { duration: 2.5 }); // 停留給予閱讀
    
    tl.add(() => {
        // 台灣島浮現放大
        let timer = typeText("直到牠們透過星際望遠鏡，鎖定了充滿絕頂美食的寶島——台灣！", 2000);
        timers.push(timer);
    });
    
    tl.to(".taiwan-island-wrapper", { opacity: 1, scale: 1, duration: 1.5, ease: "back.out(1.5)" });
    
    tl.to({}, { duration: 3.0 }); // 停留
    
    tl.to(["#act-1", ".story-subtitle-box"], { opacity: 0, duration: 1.2, ease: "power2.inOut" });
    
    // 🛸 第二幕 (Act 2)：UFO 降臨台灣與人類 404
    tl.add(() => {
        document.getElementById("act-1").classList.add("hide");
        document.getElementById("act-2").classList.remove("hide");
        
        gsap.set(".story-subtitle-box", { opacity: 1 });
        subtitleBox.innerText = "";
        
        gsap.set(".taiwan-bg", { opacity: 0 });
        gsap.set(".ufo-saucer-wrapper", { opacity: 0, top: "-120px" });
        gsap.set(".tractor-beam", { height: 0, opacity: 0 });
        gsap.set(".error-404-text", { opacity: 0, scale: 0.5 });
    });
    
    tl.to(".taiwan-bg", { opacity: 1, duration: 1.2, ease: "power2.out" });
    tl.to(".ufo-saucer-wrapper", { opacity: 1, top: "15%", duration: 1.5, ease: "power2.out" });
    
    // 綠光牽引束拉伸顯現 (解決與閃爍的 tween 爭用)
    tl.to(".tractor-beam", { height: "280px", opacity: 0.8, duration: 0.8, ease: "power1.out" });
    
    tl.add(() => {
        // 牽引束高頻閃爍
        gsap.to(".tractor-beam", { opacity: 0.3, duration: 0.1, repeat: 10, yoyo: true });
        
        // 螢幕強震
        gsap.to("#intro-story-overlay", {
            x: () => Math.random() * 20 - 10,
            y: () => Math.random() * 20 - 10,
            duration: 0.05,
            repeat: 20,
            yoyo: true,
            onComplete: () => {
                gsap.set("#intro-story-overlay", { x: 0, y: 0 });
            }
        });
        
        let timer = typeText("喵王星飛碟強勢降臨！啟動全域編碼重構...", 1500);
        timers.push(timer);
    });
    
    tl.to({}, { duration: 2.0 });
    
    tl.add(() => {
        // 404 文字震落
        gsap.to(".error-404-text", { opacity: 1, scale: 1, duration: 0.5, ease: "bounce.out" });
        
        // 噴發大量紅色粒子 (Anime.js)
        const act2 = document.getElementById("act-2");
        const rect = act2.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const particleContainer = document.createElement("div");
        particleContainer.style.position = "absolute";
        particleContainer.style.left = "0";
        particleContainer.style.top = "0";
        particleContainer.style.width = "100%";
        particleContainer.style.height = "100%";
        particleContainer.style.pointerEvents = "none";
        particleContainer.style.zIndex = "1003";
        act2.appendChild(particleContainer);
        
        const particles = [];
        for (let i = 0; i < 50; i++) {
            const p = document.createElement("div");
            p.style.position = "absolute";
            p.style.width = "8px";
            p.style.height = "8px";
            p.style.backgroundColor = "#ff3333";
            p.style.borderRadius = "50%";
            p.style.left = `${centerX}px`;
            p.style.top = `${centerY}px`;
            particleContainer.appendChild(p);
            particles.push(p);
        }
        
        let anim = anime({
            targets: particles,
            x: () => anime.random(-350, 350),
            y: () => anime.random(-350, 350),
            scale: [1.2, 0],
            opacity: [1, 0],
            duration: 1500,
            easing: "easeOutExpo",
            complete: () => {
                particleContainer.remove();
            }
        });
        animeInstances.push(anim);
        
        let timer = typeText("全人類在瞬間被全面蒸發！現在，這座島嶼正式由我們接管！", 2500);
        timers.push(timer);
    });
    
    tl.to({}, { duration: 3.5 });
    
    tl.to(["#act-2", ".story-subtitle-box"], { opacity: 0, duration: 0.8, ease: "power2.inOut" });
    
    // 📖 第三幕 (Act 3)：遠古食譜覺醒
    tl.add(() => {
        document.getElementById("act-2").classList.add("hide");
        document.getElementById("act-3").classList.remove("hide");
        
        gsap.set(".story-subtitle-box", { opacity: 1 });
        subtitleBox.innerText = "";
        
        gsap.set(".kitchen-bg", { opacity: 0 });
        gsap.set(".black-chef-wrapper", { opacity: 0, y: 0 });
        gsap.set(".recipe-book-3d-container", { opacity: 0, scale: 0.6 });
        gsap.set(".recipe-book-3d-inner", { rotationY: 0 });
    });
    
    tl.to([".kitchen-bg", ".black-chef-wrapper"], { opacity: 1, duration: 1.5, ease: "power2.out" });
    
    tl.add(() => {
        // 黑貓主廚浮動
        gsap.to(".black-chef-wrapper", { y: -10, duration: 1.5, repeat: -1, yoyo: true, ease: "power1.inOut" });
    });
    
    tl.to(".recipe-book-3d-container", { opacity: 1, scale: 1, duration: 1.0, ease: "back.out(1.5)" });
    
    tl.add(() => {
        // 3D 翻轉卡片
        gsap.to(".recipe-book-3d-inner", { rotationY: 180, duration: 1.5, ease: "power2.inOut" });
        
        // 閃爍金色粒子 (Anime.js)
        const act3 = document.getElementById("act-3");
        const container = document.querySelector(".recipe-book-3d-container");
        const rect = container.getBoundingClientRect();
        const act3Rect = act3.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2 - act3Rect.left;
        const centerY = rect.top + rect.height / 2 - act3Rect.top;
        
        const sparkContainer = document.createElement("div");
        sparkContainer.style.position = "absolute";
        sparkContainer.style.left = "0";
        sparkContainer.style.top = "0";
        sparkContainer.style.width = "100%";
        sparkContainer.style.height = "100%";
        sparkContainer.style.pointerEvents = "none";
        sparkContainer.style.zIndex = "1003";
        act3.appendChild(sparkContainer);
        
        const sparks = [];
        for (let i = 0; i < 40; i++) {
            const s = document.createElement("div");
            s.style.position = "absolute";
            s.style.width = "6px";
            s.style.height = "6px";
            s.style.backgroundColor = "#f1c40f";
            s.style.borderRadius = "50%";
            s.style.left = `${centerX}px`;
            s.style.top = `${centerY}px`;
            s.style.boxShadow = "0 0 8px #f1c40f";
            sparkContainer.appendChild(s);
            sparks.push(s);
        }
        
        let anim = anime({
            targets: sparks,
            x: () => anime.random(-150, 150),
            y: () => anime.random(-180, 180),
            scale: [1.8, 0],
            opacity: [1, 0],
            duration: 1800,
            easing: "easeOutQuad",
            complete: () => {
                sparkContainer.remove();
            }
        });
        animeInstances.push(anim);
        
        let timer = typeText("偉大的主廚，請照著神秘秘方，重新復甦地球的究極美食吧！", 2500);
        timers.push(timer);
    });
    
    tl.to({}, { duration: 3.5 });
    
    tl.to(["#intro-story-overlay", ".story-subtitle-box"], { opacity: 0, duration: 1.5, ease: "power2.inOut" });
}

// 綁定所有按鈕與導航點擊事件
// Confirmed intro animation flow from intro_animation_preview.html.
function playIntroStoryAnimation() {
    initAudio();
    state.isPaused = true;

    const overlay = document.getElementById("intro-story-overlay");
    const stage = document.getElementById("intro-stage");
    const skipBtn = document.getElementById("skip-intro-btn");
    const subtitleBox = document.getElementById("story-subtitle");
    const kitchenVideo = document.getElementById("intro-kitchen-video");

    if (!overlay || !stage || !subtitleBox) {
        const instructionsModal = document.getElementById("instructions-modal");
        if (instructionsModal) instructionsModal.classList.add("active");
        return;
    }

    const startScreen = document.getElementById("start-screen");
    const gameContainer = document.getElementById("game-container");
    if (startScreen) startScreen.classList.remove("active");
    if (gameContainer) gameContainer.style.opacity = 1;

    overlay.style.display = "flex";
    overlay.style.opacity = "1";

    const scenes = [
        {
            className: "stage-earth",
            text: "貓咪科學家透過望遠鏡，發現了一顆充滿美食能量的星球。",
            duration: 2300
        },
        {
            className: "stage-earth-zoom",
            text: "鏡頭逐漸靠近地球，神祕的美食反應越來越明顯。",
            duration: 2200
        },
        {
            className: "stage-earth-blur",
            text: "地球畫面開始模糊，鏡頭準備鎖定更精準的位置。",
            duration: 1700
        },
        {
            className: "stage-taiwan-focus",
            text: "畫面聚焦到台灣，一股強烈的料理能量正在浮現。",
            duration: 2200
        },
        {
            className: "stage-taiwan-glow",
            text: "台灣島開始發光，像是在呼喚遠方的主廚。",
            duration: 2200
        },
        {
            className: "stage-taiwan-blur",
            text: "光芒逐漸擴散，城市的輪廓從模糊中慢慢出現。",
            duration: 1700
        },
        {
            className: "stage-taipei",
            text: "鏡頭降落到台北，夕陽照亮城市，美食能量正在街道間流動。",
            duration: 2500
        },
        {
            className: "stage-scan",
            text: "掃描系統鎖定台北，美食能量反應突破臨界值。",
            duration: 2300
        },
        {
            className: "stage-ufo",
            text: "天空突然暗下，巨大的飛碟從雲層中降臨。",
            duration: 4000
        },
        {
            className: "stage-warning",
            text: "UFO 消失後，錯誤碼跳出，人類資料被重新編碼。",
            duration: 2600
        },
        {
            className: "stage-kitchen",
            text: "黑暗逐漸散去，神秘廚房中出現了新的主廚。",
            duration: 2300
        },
        {
            className: "stage-finale",
            text: "貓咪主廚準備復甦地球的究極美食！",
            duration: 3200
        }
    ];

    let sceneIndex = 0;
    let timer = null;
    let finished = false;

    const finishIntro = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (kitchenVideo) {
            kitchenVideo.pause();
            kitchenVideo.currentTime = 0;
        }
        overlay.remove();

        const instructionsModal = document.getElementById("instructions-modal");
        if (instructionsModal) {
            instructionsModal.classList.add("active");
        }
    };

    const showScene = (index) => {
        if (finished) return;
        sceneIndex = index;
        const scene = scenes[sceneIndex];
        if (!scene) {
            finishIntro();
            return;
        }

        stage.className = `intro-preview-stage ${scene.className}`;
        subtitleBox.textContent = scene.text;

        if (kitchenVideo) {
            if (scene.className === "stage-kitchen" || scene.className === "stage-finale") {
                if (scene.className === "stage-kitchen") {
                    kitchenVideo.currentTime = 0;
                }
                kitchenVideo.play().catch(() => {});
            } else {
                kitchenVideo.pause();
            }
        }

        timer = setTimeout(() => showScene(sceneIndex + 1), scene.duration);
    };

    if (skipBtn) {
        skipBtn.onclick = () => {
            SFX.playClick();
            finishIntro();
        };
    }

    showScene(0);
}

document.addEventListener("DOMContentLoaded", () => {
    const topNav = document.getElementById("top-nav");
    const navToggleBtn = document.getElementById("nav-toggle-btn");
    const navMenu = document.getElementById("nav-menu");
    const navLogo = document.querySelector(".nav-logo");
    const hud = document.getElementById("hud");
    const gameContainer = document.getElementById("game-container");
    const guestZone = document.getElementById("guest-zone");

    const moveHudForViewport = () => {
        if (!topNav || !navMenu || !hud || !gameContainer || !guestZone) return;
        if (!isMobileGameLayout()) {
            topNav.insertBefore(hud, navMenu);
            hud.classList.add("nav-hud");
        } else {
            gameContainer.insertBefore(hud, guestZone);
            hud.classList.remove("nav-hud");
        }
    };
    moveHudForViewport();
    updateOrientationLock();
    syncMobileMouseAvailability();

    const closeResponsiveNav = () => {
        if (!topNav || !navToggleBtn) return;
        topNav.classList.remove("nav-open");
        navToggleBtn.setAttribute("aria-expanded", "false");
    };

    if (navToggleBtn && topNav) {
        navToggleBtn.addEventListener("click", () => {
            SFX.playClick();
            const isOpen = topNav.classList.toggle("nav-open");
            navToggleBtn.setAttribute("aria-expanded", String(isOpen));
            if (isOpen && state.gameStarted) {
                pauseGame();
            } else if (!isOpen && state.gameStarted) {
                resumeGame();
            }
        });
    }

    if (navMenu) {
        navMenu.querySelectorAll(".nav-item").forEach((item) => {
            item.addEventListener("click", closeResponsiveNav);
        });
    }

    window.addEventListener("resize", () => {
        moveHudForViewport();
        syncMobileMouseAvailability();
        if (window.innerWidth > 1700 && topNav?.classList.contains("nav-open")) {
            closeResponsiveNav();
            if (state.gameStarted && !document.querySelector("#book-modal.active, #instructions-modal.active")) {
                resumeGame();
            }
        }
    });
    window.addEventListener("resize", updateOrientationLock);
    window.addEventListener("orientationchange", updateOrientationLock);

    // -------------------------------------------------------------
    // 🌟 頂部 Navigation Bar 聯動綁定 🌟
    // -------------------------------------------------------------
    
    // 1. 點擊：進入廚房 (Start / Resume)
    document.getElementById("nav-btn-start").addEventListener("click", () => {
        SFX.playClick();
        if (!state.gameStarted) {
            playIntroStoryAnimation();
        } else {
            // 已經開始，則關閉其餘 Overlay 繼續遊玩
            document.getElementById("book-modal").classList.remove("active");
            document.getElementById("instructions-modal").classList.remove("active");
            resumeGame();
            updateNavActiveTab("nav-btn-start");
        }
    });

    // 2. 點擊：遊戲說明 (Instructions)
    const openInstructionsAction = () => {
        SFX.playClick();
        pauseGame();
        document.getElementById("book-modal").classList.remove("active");
        document.getElementById("instructions-modal").classList.add("active");
        updateNavActiveTab("nav-btn-instructions");
    };
    document.getElementById("nav-btn-instructions").addEventListener("click", openInstructionsAction);

    const closeInstructionsAction = () => {
        document.getElementById("instructions-modal").classList.remove("active");
        if (state.gameStarted) {
            resumeGame();
        }
        updateNavActiveTab("nav-btn-start");
    };

    // 3. 點擊：食譜圖鑑 (Recipe Book)
    const openRecipeBookAction = () => {
        SFX.playClick();
        pauseGame();
        renderRecipeBook();
        document.getElementById("instructions-modal").classList.remove("active");
        document.getElementById("book-modal").classList.add("active");
        updateNavActiveTab("nav-btn-book");
    };
    document.getElementById("nav-btn-book").addEventListener("click", openRecipeBookAction);

    const closeRecipeBookAction = () => {
        document.getElementById("book-modal").classList.remove("active");
        if (state.gameStarted) {
            resumeGame();
        }
        updateNavActiveTab("nav-btn-start");
    };

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        const bookModal = document.getElementById("book-modal");
        const instructionsModal = document.getElementById("instructions-modal");
        if (bookModal.classList.contains("active")) {
            SFX.playClick();
            closeRecipeBookAction();
            return;
        }
        if (instructionsModal.classList.contains("active")) {
            SFX.playClick();
            closeInstructionsAction();
        }
    });

    // -------------------------------------------------------------
    // 🌟 開始頁面按鈕 🌟
    // -------------------------------------------------------------
    
    document.getElementById("btn-start").addEventListener("click", () => {
        playIntroStoryAnimation();
    });

    document.getElementById("btn-open-instructions-start").addEventListener("click", openInstructionsAction);
    document.getElementById("btn-open-book-start").addEventListener("click", openRecipeBookAction);

    // -------------------------------------------------------------
    // 🌟 說明模態框內部按鈕 🌟
    // -------------------------------------------------------------
    
    const enterKitchenFromInstructions = () => {
        SFX.playClick();
        document.getElementById("instructions-modal").classList.remove("active");
        if (!state.gameStarted) {
            startGame();
        } else {
            resumeGame();
            updateNavActiveTab("nav-btn-start");
        }
    };

    document.getElementById("btn-close-instructions").addEventListener("click", enterKitchenFromInstructions);
    document.getElementById("btn-start-from-instructions").addEventListener("click", enterKitchenFromInstructions);

    // -------------------------------------------------------------
    // 🌟 圖鑑模態框內部按鈕 🌟
    // -------------------------------------------------------------
    
    document.getElementById("btn-close-book").addEventListener("click", () => {
        SFX.playClick();
        closeRecipeBookAction();
    });

    // -------------------------------------------------------------
    // 🌟 輔助/結束結算按鈕 🌟
    // -------------------------------------------------------------
    
    document.getElementById("btn-game-exit").addEventListener("click", () => {
        exitToMainMenu();
    });

    document.getElementById("btn-restart").addEventListener("click", () => {
        startGame();
    });

    document.getElementById("btn-back-menu").addEventListener("click", () => {
        exitToMainMenu();
    });

    const stoveLeft = document.getElementById("stove-left-img");
    const stoveRight = document.getElementById("stove-right-img");
    const oven = document.getElementById("oven-img");
    const compactStoveLeft = document.getElementById("compact-stove-left");
    const compactStoveRight = document.getElementById("compact-stove-right");
    const compactOvenButton = document.getElementById("compact-oven-button");
    if (stoveLeft) stoveLeft.addEventListener("click", () => toggleStoveBurner("stoveLeft"));
    if (stoveRight) stoveRight.addEventListener("click", () => toggleStoveBurner("stoveRight"));
    if (oven) oven.addEventListener("click", toggleOven);
    if (compactStoveLeft) compactStoveLeft.addEventListener("click", () => toggleStoveBurner("stoveLeft"));
    if (compactStoveRight) compactStoveRight.addEventListener("click", () => toggleStoveBurner("stoveRight"));
    if (compactOvenButton) compactOvenButton.addEventListener("click", toggleOven);
    updateStoveImages();
    updateOvenImage();
});
