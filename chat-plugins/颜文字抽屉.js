/*
 * Float port of KaomojiDrawerKit by Pyruslili.
 * Source: https://github.com/Pyruslili/KaomojiDrawerKit
 * Copyright (c) 2026 Pyruslili
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const DEFAULT_CATEGORIES = [
  {
    "name": "抱抱",
    "items": [
      "꜀(˘꒳˘ ꜀)",
      "(っ꒪ཀ꒪)っ",
      "꜀(^. .^꜀  )꜆੭",
      "─=≡Σ((( つ•̀ω•́)つ"
    ]
  },
  {
    "name": "坏",
    "items": [
      "(￢‿￢)",
      "(→_→)",
      "(◔_◔)",
      "(˶ ¬  ¬˶)",
      "(￢、￢)"
    ]
  },
  {
    "name": "震惊",
    "items": [
      "| ू•ૅω•́)ᵎᵎᵎ",
      "| ू•ૅω•́)ﾉ",
      "=͟͟͞͞ʕ ⸝⸝⸝⁰ ༝ ⁰ ʔ",
      ".(꒪ȏ꒪)？",
      "◔‸◔？",
      "(⑉0-0⑉)",
      "=͟͟͞͞(꒪⌓꒪*)",
      "♡°͈▵°͈)",
      "Σ(๑°꒳°๑)ᵎᵎᵎ",
      "(°ー°〃)",
      "(๑°⌓°๑)",
      "(´⊙ω⊙`)",
      "( ゜- ゜)つロ",
      "(⊙o⊙)",
      "◍⁰ᯅ⁰◍ .ᐟ.ᐟ",
      "(ﾟДﾟ≡ﾟдﾟ)!?",
      "{{(°△°; \"}}!",
      "₍⸍•д•⸌₎",
      "(′ʘ⌄ʘ‵)",
      "( ˚ཫ˚ )",
      "(◍꒪꒳꒪◍)՞",
      "⁉️(◍ᴼ ▯ᵒ◍)",
      "(ૈ  ᵒ̌▱๋ᵒ̌ )ૈ=͟͟͞͞ ⌨",
      "⁽⁽◞(꒪ͦᴗ̵̍꒪ͦ=͟͟͞͞ ꒪ͦᴗ̵̍꒪ͦ)◟⁾⁾"
    ]
  },
  {
    "name": "迷惑",
    "items": [
      "(˘•ω•˘ )？",
      "( ´◔ ‸◔')"
    ]
  },
  {
    "name": "无奈",
    "items": [
      "╮( •́ω•̀ )╭",
      "(-ι_- )",
      "(´-﹏-`；)"
    ]
  },
  {
    "name": "尴尬",
    "items": [
      "(•́ω•̀ ٥)",
      "⦁֊⦁꧞",
      "(´･ω･`)"
    ]
  },
  {
    "name": "冷脸萌",
    "items": [
      "(ㅍ_ㅍ)",
      "(•̅灬•̅ )",
      "(҂`･ｪ･´)",
      "՞˶･֊･˶՞",
      "(⩌⩊⩌)",
      "(ᐡᯣ.ᯣกᐡ)",
      "( ˶˙ ᴥ ˙ ˶)",
      "՞⩌⌯⩌՞",
      "ᗜ - ᗜ",
      "=⩌⩊⩌=",
      "( ᓀ◞ᓂ..)",
      "Ծ‸Ծ",
      "(ᯣ_ᯣ)",
      "(눈_눈)"
    ]
  },
  {
    "name": "亲亲",
    "items": [
      "( ˘ ³˘)",
      "(づ￣ ³￣)づ～",
      "❤´ʚ｀",
      "(๑˘ ³˘๑)♡",
      "( ˘ ³˘)〜♡〜(˘ε˘ )",
      "(⸝⸝> 3( / _ ᖛ )",
      "(  ^   )ε・ )",
      "(⸝⸝> ૩(>_<⸝⸝)",
      "(ˆ⸝⸝> ꇴ <ˆ)ε <⸝⸝ˆ)",
      ":(っ´ᾥ´)`ᾥ´c):",
      "( ˘ ³˘))`꒳' 𓂂)"
    ]
  },
  {
    "name": "捂脸",
    "items": [
      "(っ´꒳´c)",
      "(っ˘ω˘ς )"
    ]
  },
  {
    "name": "害羞",
    "items": [
      "꒰⌗´͈ ᵕ `͈⌗꒱৩",
      "(ᐥᐜᐥ)♡︎ᐝ",
      "₍ᐢ⸝⸝•ω•⸝⸝ᐢ₎",
      "(՞,,⁃ ₃ ⁃,,՞)",
      "すき (◍ˊ⩊ˋ◍)",
      "(● ˘∇ ˘●)",
      "(＊❛ω❛＊)",
      "( ˶ᵔ ᗜ ᵔ˶ )",
      "(•́⌄•́๑)૭✧",
      "૮꒰ྀི⸝⸝ɞ̴̶̷ ·̫ ‹⸝⸝꒱ྀིა",
      "(ꈍᴗꈍ",
      "♪ *ꈍ﹃ꈍ)ﾉ",
      "ʕ ⸝⸝⸝⁰⃚⃙̴ ༝ ⁰⃚⃙̴ ʔ",
      "ʕ ⸝⸝⸝⁰ ༝ ⁰ ʔ",
      "ʕ ⸝⸝⸝⁰ ༝ ⁰ ⸝⸝ʔ",
      "(⸝⸝⸝ ╸▵╺⸝⸝⸝)⋆⁺₊⋆",
      "૮(˶ᵔ ᵕ ᵔ˶)ა",
      "( ´͈ ꒫ `͈ )◞",
      "*͈ᴗ͈ˬᴗ͈ෆ⑅",
      "(˶ᵔ ᵕ ᵔ˶)"
    ]
  },
  {
    "name": "馋",
    "items": [
      "～(￣▽￣～)",
      "(っ˘﹃˘ς)",
      "( ¯﹃¯ )♡",
      "˶ˊᜊˋ˶",
      "՞⸝⸝'ᜊ'⸝⸝՞",
      "(⁎⁍̴̀﹃⁍̴́⁎)",
      "(◍´△`◍)",
      "(◍´O`◍)"
    ]
  },
  {
    "name": "严肃",
    "items": [
      "(⑉･̆-･̆⑉)"
    ]
  },
  {
    "name": "伤心",
    "items": [
      "(ˆт · тˆ)",
      "(īī ^ īī)",
      "( ˘̩̩ε˘̩ƪ)",
      "(  ⩌⤚⩌ )",
      "/ᐠ> ˕ <マ੭",
      "(｡•́_ก̀｡)",
      "(⸝⸝>﹏<⸝⸝)",
      "(っ ̯ -｡)",
      "ˆ𓂂ɞ̴̶̷ . ɞ̴̶̷𓂂 ྀིྀིྀིྀི",
      "˃̣̣ᯅก",
      "ᵕ᷄≀ ̠ᵕ᷅",
      "‎꒰ᐢ ｡> ༝ ก ᐢ ꒱",
      "˰̮⛻̴⃠︣⸝⸝̼⸝֪⛻̴⃠︣",
      "(ᵒ̴̶̷̥́ _ ᵒ̴̶̷̣̥̀)",
      "꧞ ༝ ꧞"
    ]
  },
  {
    "name": "傲娇",
    "items": [
      "o(´^｀)o"
    ]
  },
  {
    "name": "失落",
    "items": [
      "₍ᐢ๑ ̯๑ᐢ₎"
    ]
  },
  {
    "name": "不高兴",
    "items": [
      "๑'~'๑",
      "(▼ヘ▼#)",
      "(⇀‸↼‶)",
      "(๑‾᷅^‾᷅๑)",
      "(ㅎ‸ㅎ).ᐟ.ᐟ",
      "⦕(>ロ<)⦖",
      "૮₍。·᎔· 。₎ა",
      "૮₍ - ⤙ - ₎ა",
      "૮₍ ˃ ⤙ ˂ ₎ა.",
      "(◦`~´◦)",
      "(ྀི･̆༝･̆⌯)ྀི",
      "-᷅ ⤙ -᷄",
      "(๑`^´๑)"
    ]
  },
  {
    "name": "卖萌",
    "items": [
      "ᜊʕ ྀི . . . ྀིʔᜊ",
      "- ̗̀ʚ ๑'~'๑ ɞ  ̖́-",
      "˚₊*(ˊॢo̶̶̷̤ .̫ o̴̶̷̤ˋॢ)*₊˚",
      "(◍`•ө•´◍)",
      "(･∞･ﾐэ )Э",
      ".+°⊹⁺˖໋̟⸝⸝  𑣧⃙̴ཻ̑꙯⃩⃔⃕͡᷍ ⸝⸝𑌻̢⸝̠⸝⃬⸝ 𑣧⃙̴ཻ̑꙯⃩⃔⃕͡᷍ ⸝⸝ ᘁᩚ ˖ᕀ⸜̑⸝͂˖⁺໋̟",
      "ᜊ(♡ ¯꒳​¯ )ᜊ",
      "ᜊ( ´꒳` )ᜊ",
      "૮꒰ ˶• ༝ •˶꒱ა ♡",
      "⊹⁺˖໋̟⸝⸝  𑣧⃙̴ཻ̑꙯⃩⃔⃕͡᷍ ⸝⸝𑌻̢⸝̠⸝⃬⸝ 𑣧⃙̴ཻ̑꙯⃩⃔⃕͡᷍ ⸝⸝ ᘁᩚ ˖ᕀ⸜̑⸝͂˖⁺໋̟⊹",
      "⁺⊹ꉂ  ᳐˶ᵒ ᵕ ˂˶  ᳐ฅ໑ ₊˚",
      "꒰ঌ⌯'ᵕ'⌯໒꒱",
      "(。•̀ᴗ-)✧",
      "₍՞˶⦁֊⦁˶՞₎੭ﾞ",
      "𖦹‎´༥`𖦹‎."
    ]
  },
  {
    "name": "猫咪",
    "items": [
      "ꉂ ･ ･ ིྀฅ",
      "ꉂ ᳐˶ᵒ ᵕ ˂˶ ᳐ฅ",
      "ᓚᘏᗢ",
      "(ᐡ⦁⩊⦁⸝⸝ᐡ )₊୭",
      "^⌯𖥦⌯^ ੭",
      "𑁊^.  ̫ .^𑁊",
      "（𓐍ˊ꒳ˋ𓐍） ੭ﾞ",
      "₍˄·͈༝·͈˄*₎◞ ̑̑",
      "₍˄·͈༝·͈˄₎",
      "≽^⦁𖥦⦁^ ≼🐾",
      "^⌯𖥦⌯^ ྀི",
      "^ ̳- ‧̫ • ̳^ฅ",
      "^•𐃷•^ฅ",
      "⦮_  ̫ _⦯",
      "^_   ̫  _ ̥`",
      "ฅ՞••՞ฅ"
    ]
  },
  {
    "name": "睡觉",
    "items": [
      "ʢᴗ.ᴗʡᶻ",
      "(՞_  ̫ _՞)ᐝ",
      "(´-ωก`)☡zᶻ",
      "≡(　ε:)",
      "ᶻz ₍^_   ̫ _^₎",
      "^_   ̫  _ ̥`",
      "ᯠ _   ̫  _ ᯄ ੭"
    ]
  },
  {
    "name": "双人",
    "items": [
      "(′。-ω(-ω-。`)",
      "(ˆ꜆ .  ̫ . ).  ̫ . ꜀ˆ)",
      "(/^-^(^ ^*)/",
      "ɷ(   ᳐⊃⦁⩊⦁ )⦁⩊⦁ ⊂  ᳐ )",
      "(ᐡ´• ·̫•)ﾉ(-‧̫ -`ᐡ)",
      "( U - ·̫ - )ﾉ( •̥ ·̫ •̥Ｕ )",
      "꒰ U - ·̫ - ꒱ﾉ꒰ •̥ ·̫ •̥Ｕ ꒱",
      "( - ·̫ - )ﾉ( •̥ ·̫ •̥ )",
      "( ᵕ ⸝⸝- · - )ﾉ( •̥ · •̥⸝⸝ ᵕ )♡",
      "( U⩌⩊⩌)ﾉ( ᴛ ω ᴛＵ )",
      "( Ｕ '-' )ノ('ᴗ' Ｕ)",
      "( ू•ૅω•́)ﾉ(ᵒ̴̶̷̥́ _ ᵒ̴̶̷̣̥̀)",
      "ʕ՞˶˃ ꇴ ˂˶ ྀིʔﾉ( ᵒ̴̶̷̥́ _ ᵒ̴̶̷̣̥̀ )",
      "( ᵒ̴̶̷̥́ _ ᵒ̴̶̷̣̥̀ )꜆੭=͟͟͞͞  ԅ(՞˶˃ ꇴ ˂˶ ྀིԅ)",
      "( ・▽・)>♡<( ・▽ ・ )",
      "(ㆆ⩊ㆆ)♡ (⎚灬⎚)",
      "(´･･)ﾉ(._.`)",
      "(╯‵□′)╯︵ /(.□ . \\)",
      "‎⊹ ｡*₍ᐢ .  ̫.ᐢ₎ ₍ᐢ. ̫ .⑅ᐢ₎⊹ ･｡",
      ".°⑅ପ₍ᐢ｡•༝•｡ᐢ₎₍ᐢ｡•༝•｡ᐢ₎ଓ⑅°."
    ]
  },
  {
    "name": "丑陋",
    "items": [
      "༼´༎ຶ𓂏༎ຶ༽",
      "（༎ຶ-༎ຶ）",
      "ꈨຶꎁꈨຶ",
      "(;´༎ຶД༎ຶ`)",
      "༎ຶ‿༎ຶ",
      "(;´༎ຶ༎ຶ`)",
      "༼༎ຶ෴༎ຶ༽",
      "（𓁹𓂏𓁹）",
      "༼;´༎ຶ   ༎ຶ༽",
      "༗.̫̮ ༗",
      "𓃟❤︎",
      "༼༎ຶ_༎ຶ༽ᕗ",
      "（𓁹𓂏𓁹)",
      "༼   ༎ຶ ෴ ༎ຶ༽",
      "( ఠൠఠ )ﾉ",
      "༼   ༎ຶ𓂏༎ຶ༽",
      "༼ ༎ຶ ෴ ༎ຶ༽",
      "༼    *꒪ั❥꒪ั*༽༽༾",
      "(◉◞હ̱◟◉)༿"
    ]
  }
];

export default {
  manifest: {
    id: "kaomoji-drawer-kit",
    name: "颜文字抽屉",
    apiVersion: 1,
    version: "1.0.0",
    description: "21 组颜文字抽屉；点选后插入聊天草稿，支持自定义、删除与恢复默认。",
  },

  setup(ctx) {
    const cloneDefaults = () => DEFAULT_CATEGORIES.map(category => ({
      name: category.name,
      items: [...category.items],
    }));
    const loadCategories = () => {
      const saved = ctx.system.storage.get("categories");
      return Array.isArray(saved) && saved.length ? saved : cloneDefaults();
    };
    const saveCategories = categories => ctx.system.storage.set("categories", categories);
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
    const insertIntoDraft = text => {
      if (typeof ctx.ui.insertText === "function") return ctx.ui.insertText(text, { focus: true });
      const textarea = Array.from(document.querySelectorAll(".chat-input-textarea"))
        .find(el => !el.disabled && el.offsetParent !== null);
      if (!textarea) return false;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      const next = textarea.value.slice(0, start) + text + textarea.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(textarea, next);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      const cursor = start + text.length;
      requestAnimationFrame(() => {
        textarea.setSelectionRange(cursor, cursor);
        textarea.focus();
      });
      return true;
    };

    ctx.ui.injectCSS(`
      .km-toolbar-button{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:64px;padding:4px;border:0;background:transparent;color:var(--c-text);font:inherit;cursor:pointer}
      .km-toolbar-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:var(--c-card-bg,#fff);box-shadow:0 2px 10px rgba(45,25,31,.08);font-size:23px;color:#bd5e79}
      .km-toolbar-label{font-size:11px;line-height:1.2}
      .km-sheet{width:min(620px,100vw);height:min(78vh,720px);display:flex;flex-direction:column;overflow:hidden;border-radius:24px 24px 0 0;background:linear-gradient(180deg,#fbeef0,#f6e5e8);color:#3b2e33;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;box-shadow:0 -12px 40px rgba(83,47,59,.18)}
      .km-header{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;padding:14px 16px 8px}
      .km-icon-button{width:42px;height:42px;border:1px solid rgba(193,94,123,.13);border-radius:50%;background:rgba(255,255,255,.72);color:#bd5e79;font-size:18px;cursor:pointer}
      .km-title{text-align:center;font-size:16px;font-weight:650}.km-count{text-align:center;color:#78636a;font-size:10px;margin-top:2px}
      .km-tabs{display:flex;gap:8px;overflow-x:auto;padding:5px 16px 10px;scrollbar-width:none}.km-tabs::-webkit-scrollbar{display:none}
      .km-tab{flex:none;height:32px;padding:0 13px;border:1px solid rgba(193,94,123,.13);border-radius:999px;background:rgba(255,255,255,.72);color:#78636a;font:600 12px inherit;cursor:pointer}
      .km-tab.is-active{border-color:#bd5e79;background:#bd5e79;color:#fff}
      .km-scroll{flex:1;overflow:auto;padding:0 16px 20px}.km-section{margin-bottom:16px}.km-section-head{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;padding:9px 1px 7px;background:rgba(251,238,240,.94);font-size:13px;font-weight:650}.km-section-count{color:#78636a;font-size:11px;font-weight:400}
      .km-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px}.km-face{position:relative;min-height:44px;padding:8px 11px;border:1px solid rgba(193,94,123,.10);border-radius:12px;background:rgba(255,255,255,.72);color:#3b2e33;text-align:left;font:14px/1.35 inherit;overflow-wrap:anywhere;cursor:pointer}.km-face:active{transform:scale(.98)}
      .km-face-delete{display:none;position:absolute;right:5px;top:50%;translate:0 -50%;width:28px;height:28px;border:0;border-radius:50%;background:#d96872;color:white;font-weight:700}.km-sheet.is-editing .km-face{padding-right:38px;cursor:default}.km-sheet.is-editing .km-face-delete{display:block}
      .km-add{margin-top:10px;padding:14px;border:1px solid rgba(193,94,123,.12);border-radius:18px;background:rgba(255,255,255,.68)}.km-add-title{font-size:13px;font-weight:650;margin-bottom:9px}.km-add-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(92px,130px) 40px;gap:8px}.km-input,.km-select{min-width:0;height:40px;border:1px solid rgba(193,94,123,.14);border-radius:12px;background:rgba(255,255,255,.82);color:#3b2e33;padding:0 11px;font:14px inherit;outline:none}.km-add-button{width:40px;height:40px;border:0;border-radius:50%;background:#bd5e79;color:#fff;font-size:20px;cursor:pointer}.km-foot{display:flex;justify-content:flex-end;padding-top:10px}.km-reset{border:0;background:transparent;color:#946273;font:12px inherit;cursor:pointer}
      @media(max-width:480px){.km-sheet{height:82vh}.km-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.km-add-row{grid-template-columns:minmax(0,1fr) 40px}.km-select{grid-column:1/-1;grid-row:1}.km-input{grid-row:2}.km-add-button{grid-row:2}}
    `);

    function openDrawer() {
      let categories = loadCategories();
      let activeCategory = null;
      let editing = false;

      ctx.ui.openModal((el, modal) => {
        if (el.parentElement) {
          el.parentElement.style.alignItems = "flex-end";
          el.parentElement.style.padding = "0";
          el.parentElement.style.background = "rgba(37,25,29,.28)";
        }
        el.style.cssText = "width:100%;max-width:none;background:transparent;box-shadow:none;border-radius:0;max-height:none;overflow:visible;display:flex;justify-content:center";

        const render = () => {
          const visible = activeCategory
            ? categories.filter(category => category.name === activeCategory)
            : categories;
          const count = categories.reduce((total, category) => total + category.items.length, 0);
          el.innerHTML = `
            <section class="km-sheet${editing ? " is-editing" : ""}">
              <header class="km-header">
                <button class="km-icon-button" data-action="edit" aria-label="${editing ? "完成编辑" : "编辑颜文字"}">${editing ? "✓" : "✎"}</button>
                <div><div class="km-title">颜文字抽屉</div><div class="km-count">${count} 个颜文字</div></div>
                <button class="km-icon-button" data-action="close" aria-label="关闭">×</button>
              </header>
              <nav class="km-tabs">
                <button class="km-tab${activeCategory === null ? " is-active" : ""}" data-category="">全部</button>
                ${categories.map(category => `<button class="km-tab${activeCategory === category.name ? " is-active" : ""}" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)}</button>`).join("")}
              </nav>
              <div class="km-scroll">
                ${visible.map(category => `
                  <section class="km-section">
                    <div class="km-section-head"><span>${escapeHtml(category.name)}</span><span class="km-section-count">${category.items.length}</span></div>
                    <div class="km-grid">${category.items.map((face, index) => `
                      <button class="km-face" data-face="${escapeHtml(face)}" data-owner="${escapeHtml(category.name)}" data-index="${index}">${escapeHtml(face)}<span class="km-face-delete" aria-label="删除">−</span></button>
                    `).join("")}</div>
                  </section>`).join("")}
                <section class="km-add">
                  <div class="km-add-title">添加新颜文字</div>
                  <div class="km-add-row">
                    <input class="km-input" data-role="new-face" placeholder="粘贴或输入颜文字" />
                    <select class="km-select" data-role="new-category">
                      <option value="我的颜文字">我的颜文字</option>
                      ${categories.filter(category => category.name !== "我的颜文字").map(category => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("")}
                    </select>
                    <button class="km-add-button" data-action="add" aria-label="添加">＋</button>
                  </div>
                  <div class="km-foot"><button class="km-reset" data-action="reset">恢复默认颜文字</button></div>
                </section>
              </div>
            </section>`;
        };

        const onClick = event => {
          const target = event.target.closest("button");
          if (!target) return;
          if (target.dataset.action === "close") return modal.close();
          if (target.dataset.action === "edit") { editing = !editing; render(); return; }
          if (Object.prototype.hasOwnProperty.call(target.dataset, "category")) {
            activeCategory = target.dataset.category || null;
            render();
            return;
          }
          if (target.dataset.action === "reset") {
            if (!confirm("恢复默认颜文字？你添加的内容会被清除。")) return;
            categories = cloneDefaults(); saveCategories(categories); activeCategory = null; render(); return;
          }
          if (target.dataset.action === "add") {
            const input = el.querySelector('[data-role="new-face"]');
            const select = el.querySelector('[data-role="new-category"]');
            const value = input.value.trim();
            const name = select.value.trim() || "我的颜文字";
            if (!value) return input.focus();
            let category = categories.find(item => item.name === name);
            if (!category) { category = { name, items: [] }; categories.unshift(category); }
            if (!category.items.includes(value)) category.items.unshift(value);
            saveCategories(categories); render(); return;
          }
          if (target.classList.contains("km-face")) {
            const category = categories.find(item => item.name === target.dataset.owner);
            if (!category) return;
            if (editing || event.target.classList.contains("km-face-delete")) {
              category.items.splice(Number(target.dataset.index), 1);
              categories = categories.filter(item => item.items.length);
              saveCategories(categories); render(); return;
            }
            if (insertIntoDraft(target.dataset.face || "")) modal.close();
            else ctx.ui.toast("当前没有可用的聊天输入框");
          }
        };
        el.addEventListener("click", onClick);
        render();
        return () => el.removeEventListener("click", onClick);
      });
    }

    return ctx.ui.slot("chat.inputToolbar", el => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "km-toolbar-button";
      button.innerHTML = '<span class="km-toolbar-icon">(˶ᵔ ᵕ ᵔ˶)</span><span class="km-toolbar-label">颜文字</span>';
      button.addEventListener("click", openDrawer);
      el.appendChild(button);
      return () => button.removeEventListener("click", openDrawer);
    });
  },
};
