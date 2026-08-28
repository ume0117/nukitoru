// ============================================================
// recipe-catalog.ts
//
// MISSION 2.11 PHASE B — 静的レシピカタログ（第一弾）。
//
// PHASE Aで定義した Recipe 型を使った独立のデータ層。
// mock-meal-provider.ts の既存CATALOG（5品・候補生成ロジック）とは
// まだ接続しない（このPHASEでは候補生成アルゴリズムを一切変更しない）。
//
// 各Recipeの安全上の注意:
// - allergyRelevantIngredients() は requiredIngredients + seasonings のみを見る。
//   arrangements.addIngredients はこの集合に含まれない
//   （アレンジのために基本料理そのものを除外しない設計を維持する）。
// - steps は「○分加熱すれば安全」「これで食中毒を防げます」等の安全断定を
//   一切含めず、常に具体的な行動として記述する。
// - requiredIngredients / seasonings は canonicalizeIngredientName() を通した際に
//   同一料理内で重複しないよう記述する（例: 豚肉と豚こまを同時に書かない）。
//   豚肉・豚ひき肉・鶏肉等、部位や挽き肉が異なるものは意図的に別名のまま扱う。
//
// MISSION 2.11 PHASE D.2 — Recipe Ingredient Integrity（水・湯の扱い）:
// 水・湯は各家庭に常にあるとみなす基礎媒体として扱い、requiredIngredients /
// seasoningsには含めない（買い足しが必要な食材ではないため）。stepsの中で
// 「水を加える」「湯を沸かす」等と書くことは許可する。だし・片栗粉・カレー
// ルー等、パントリー在庫として意識される食材はこの例外に含めず、必ず
// requiredIngredientsまたはseasoningsへ明記する（Reality Gate参照）。
//
// 米 / ごはんの区別（PHASE D.2で確定）:
// 「米」= 生米（炊飯が必要）。「ごはん」= 炊飯済み。互いに別canonicalであり、
// 「米」を入力したユーザーへ炊飯済み前提の短時間レシピを出さない。
// 炊飯工程を含むRecipe（塩むすび・のり塩おにぎり）は requiredIngredients に
// 「米」を使い、炊飯器をequipmentへ含め、現実的なcookingTimeMinutesを設定する。
// 炊飯済みのごはんを使うだけの丼・朝食系Recipeは requiredIngredients に
// 「ごはん」を使う。
//
// MISSION 2.11 PHASE D.3 — Ingredient & Seasoning Amount Foundation:
// requiredIngredients / seasonings は { name, amount } のRecipeIngredient配列。
// amountは常に「servingsBase人数分の基準量」。value:number/unit:stringへの
// 過剰な構造化はせず、日本語の自然な分量表現（大さじ1と1/2、1/2個、少々、
// 適量 等）をそのまま文字列として保持する。amountはcanonicalization・
// allergy判定・A/B候補判定のいずれにも一切使わない（.nameのみを使う）。
// 自動人数換算（今日の人数に応じた分量の自動倍率計算）はここでも行わない。
//
// MISSION 2.11 PHASE D.4 — Cooking Liquid Foundation:
// steps中で「水を加えて煮る」等と書くだけでは絶対量が分からず再現できない
// Recipeに対し、cookingLiquids（水・湯のみ）で基準量を明示する。
// requiredIngredients/seasoningsとは別枠とし、候補判定・Stock照合・
// allergy判定のいずれにも使わない（水を買い足し食材として扱わないため）。
// 「具材が浸る程度の水」等、steps内に既に相対量が明記済みのRecipeや、
// ゆでこぼす湯（パスタ等、味に影響しない）には追加しない。
// ============================================================

import type { Recipe } from '@/features/food/types'

export const RECIPE_CATALOG: Recipe[] = [
  // ------------------------------------------------------------
  // ごはん・丼
  // ------------------------------------------------------------
  {
    id: 'shio-musubi',
    name: '塩むすび',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '米', amount: '1合' }],
    seasonings: [{ name: '塩', amount: 'ひとつまみ' }],
    cookingTimeMinutes: 60,
    servingsBase: 2,
    tags: ['ごはん', '時短', '子ども向け'],
    equipment: ['炊飯器', 'ボウル', 'ラップ'],
    steps: [
      '米を研いで炊飯器で炊く',
      '炊き上がったごはんをボウルに移す',
      '塩を加え、全体に軽く混ぜる',
      'ラップにごはんをのせて包む',
      '好みの形にやさしく握る',
    ],
    notes: ['炊飯器の機種や米の量により炊き上がりまでの時間は前後します。'],
    // MISSION 2.11 PHASE D.7-B — 塩「少々」→「ひとつまみ」に訂正（sirogohan.comの材料欄に
    // 明記の実際の表記に合わせた。CURRENT: 少々 / SOURCE: sirogohan-siomusubi-2026
    // 「塩...ひとつまみ」/ DECISION: ひとつまみへ変更 / WHY: source本文を再読し「少々」
    // という語が一切登場せず「ひとつまみ」表記のみだったため / EVIDENCE TYPE: direct）。
    //
    // MISSION 2.11 PHASE D.7-B.1 — Evidence Range Integrity Fixにより、cookingTimeMinutes
    // の扱いを訂正。日立公式のcooking time Evidenceは最後まで「40〜60分」というrangeで
    // あり、それをexact値（50分や60分）に収縮させることはEvidenceの直接支持ではない。
    // Recipe.cookingTimeMinutes=60（rangeの中央値50分＋sirogohan.comが明示する握り工程10分）
    // は「NUKITORU Product Decision」として`verification.productDecisions`に別途記録し、
    // fieldVerificationsのcookingTimeMinutesはsupportType='range'のまま
    // （=Evidence解決済みとしてカウントしない）。この結果、Critical Fieldが1件でも
    // 未解決（range）のためVERIFIED条件を満たさなくなり、status='verified'から
    // 'review'へ差し戻す（VERIFIED維持を目的にした緩和は行わない）。
    verification: {
      status: 'review',
      sourceIds: [
        'maff-rice-weight-2026',
        'tabechoku-rice-servings-2026',
        'hitachi-rice-cooker-time-2026',
        'sirogohan-siomusubi-2026',
      ],
      recipeIdentity: {
        canonicalDish: '塩むすび',
        variant: '具・アレンジなしの基本の塩むすび（塩のみ）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的・シンプルな塩味',
        coreMethod: '米を炊飯器で炊き、塩を混ぜて握る',
        definingIngredients: ['米', '塩'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
          supportType: 'range',
          derivation:
            'Evidence Factは「日立公式・白米ふつうコース40〜60分」というrangeのみ（＋sirogohan.comの握り工程10分は直接事実）。Recipeのcookingtime=60はこのrangeから選んだ代表値であり、Evidence直接支持ではなくProduct Decision（下記productDecisions参照）。',
          evidenceRange: { min: 40, max: 60, unit: '分' },
        },
        {
          field: 'servingsBase',
          sourceIds: ['maff-rice-weight-2026', 'tabechoku-rice-servings-2026'],
          supportType: 'derived',
          derivation:
            'MAFF: 米1合(150g)は炊飯で2.2〜2.3倍(約330〜340g)になる、という直接事実。tabechoku: 「2人分なら1〜1.5合が目安」と1合を2人分の下限として直接明記。両者を組み合わせ、1合=2人分は妥当という結論。',
        },
        { field: 'criticalSteps', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
      ],
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '60分',
          reason:
            '日立公式range（白米ふつう40〜60分）の中央値50分に、sirogohan.com（専門家）が明示する握り工程10分を加算。特定の炊飯器機種・モードを仮定しない場合の代表値としてNUKITORUが採用した。安全側（やや長め）の見積もりであり、実際の炊飯器によっては短く済む場合がある。',
          referenceSourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
        },
      ],
      reviewNotes: [
        'cookingTimeMinutesのEvidence FactはrangeであるためCritical Fieldが未解決。VERIFIEDから差し戻しREVIEWとした（PHASE D.7-B.1: Evidence Range Integrity Fix）。他のfield（食材・分量・調味料・人数・工程・器具）はdirect/derivedで解決済み。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'onigiri-nori',
    name: 'のり塩おにぎり',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '米', amount: '1合' },
      { name: 'のり', amount: '2枚' },
    ],
    seasonings: [{ name: '塩', amount: 'ひとつまみ' }],
    cookingTimeMinutes: 60,
    servingsBase: 2,
    tags: ['ごはん', '時短', '子ども向け'],
    equipment: ['炊飯器', 'ボウル', 'ラップ'],
    steps: [
      '米を研いで炊飯器で炊く',
      '炊き上がったごはんをボウルに移す',
      '塩を加え、全体に軽く混ぜる',
      'ラップにごはんをのせて包み、好みの形にやさしく握る',
      'のりを巻いて完成',
    ],
    notes: ['炊飯器の機種や米の量により炊き上がりまでの時間は前後します。'],
    // 塩「少々」→「ひとつまみ」は塩むすびと同根拠。cookingTimeMinutes 60分は
    // PHASE D.7-B.1のEvidence Range Integrity Fixにより、Evidence直接支持ではなく
    // Product Decisionとして扱う（下記productDecisions参照。塩むすびと同じ扱い）。
    verification: {
      status: 'review',
      sourceIds: [
        'maff-rice-weight-2026',
        'tabechoku-rice-servings-2026',
        'hitachi-rice-cooker-time-2026',
        'sirogohan-siomusubi-2026',
      ],
      recipeIdentity: {
        canonicalDish: '塩むすび（のり巻き）',
        variant: '塩むすびにのりを巻いた基本のおにぎり',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的・シンプルな塩味＋のりの風味',
        coreMethod: '米を炊飯器で炊き、塩を混ぜて握り、のりを巻く',
        definingIngredients: ['米', '塩', 'のり'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
          supportType: 'range',
          derivation:
            'shio-musubiと同じEvidence Fact（日立公式rangeの40〜60分＋sirogohan.comの握り工程10分）。Recipeのcookingtime=60はrangeからの代表値でありEvidence直接支持ではない（下記productDecisions参照）。',
          evidenceRange: { min: 40, max: 60, unit: '分' },
        },
        {
          field: 'servingsBase',
          sourceIds: ['maff-rice-weight-2026', 'tabechoku-rice-servings-2026'],
          supportType: 'derived',
          derivation: 'shio-musubiと同じ導出（MAFF換算＋tabechokuの「1合で2人分」明記の組み合わせ）。',
        },
        { field: 'criticalSteps', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
      ],
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '60分',
          reason: 'shio-musubiと同じ理由（日立公式rangeの中央値50分＋握り工程10分、特定機種非仮定の代表値）。',
          referenceSourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
        },
      ],
      reviewNotes: [
        'CURRENT: のり2枚 / SOURCE A: （なし） / SOURCE B: （なし） / DECISION: 変更なし（現状維持） / WHY: 複数のnori専門店・レシピサイトを調査したが「おにぎり1個につきのり何枚」を明記した信頼できるsourceが見つからなかった（味匠七福屋のページも枚数を明記していないことを再確認済み） / EVIDENCE TYPE: NOT_FOUND。',
        'cookingTimeMinutesもEvidence FactがrangeのためCritical Field未解決（PHASE D.7-B.1）。のり2枚のNOT_FOUNDと合わせ、複数の理由でVERIFIEDにはできない。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'maguro-don',
    name: 'まぐろ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: 'マグロ', amount: '200g' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['丼', '魚', '生食'],
    equipment: ['包丁', 'まな板', '丼'],
    steps: [
      'ごはんを丼によそう',
      'マグロを食べやすい大きさに切る',
      'マグロをごはんにのせる',
      'しょうゆを添える',
    ],
    notes: ['生食用として販売されている魚を使用してください。購入後は早めに食べてください。'],
    arrangements: [
      { id: 'maguro-don-egg-yolk', label: '卵黄をのせる', addIngredients: ['卵'] },
      { id: 'maguro-don-nori', label: 'きざみのりを散らす', addIngredients: ['のり'] },
    ],
    verification: {
      status: 'review',
      sourceIds: ['kamada-maguro-zukedon-2026'],
      recipeIdentity: {
        canonicalDish: 'まぐろ丼',
        variant: '漬けない・刺身をそのままのせて醤油を添える方式（漬け丼ではない）',
        servingsBasis: 2,
        intendedTasteProfile: '素材の味を活かした、食卓で醤油を各自の好みで使うシンプルな刺身丼',
        coreMethod: 'マグロを切ってごはんにのせ、しょうゆは添えるのみ（漬け込まない）',
        definingIngredients: ['マグロ', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
        { field: 'ingredientAmounts', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
        { field: 'servingsBase', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: requiredIngredients=マグロ200g・ごはん2杯分(2人分) / SOURCE A: kamada-maguro-zukedon-2026「刺身用マグロ200g・ごはん2人分」/ DECISION: 変更なし（現状維持） / WHY: 魚種・重量・人数はSourceと一致するが、Sourceは「漬け丼」variant（さしみ醤油大さじ2+みりん大さじ1に漬け込む）でありNUKITORUの「そのままのせて添える」variantとは調理法(coreMethod)が異なるため、Recipe Identity不一致によりVARIANT SUPPORTと判定し「解決済み」としてはカウントしない / EVIDENCE TYPE: variant。',
        'CURRENT: seasonings=しょうゆ大さじ1（添える用）/ SOURCE A: 同上（漬け込み用の分量） / DECISION: 変更なし / WHY: 「添えるだけ」variantの具体的な分量を明記した信頼できるsourceが見つからなかった（食卓で各自使う分のため定量化が難しい可能性がある）。漬け込み用の分量をそのまま流用するのはvariant混同にあたるため採用しない / EVIDENCE TYPE: NOT_FOUND。',
        '1 sourceのみで、かつ独立した第2のsourceも見つかっていない。',
        'MISSION 2.12 PHASE B — 「漬け込まずそのまま乗せて醤油を添える」というNUKITORUの'
          + 'variantに一致する専門家/メーカー/公的機関sourceを再調査したが（「刺身丼 基本」'
          + '「まぐろ丼 漬けない」等で検索）、見つかったのは引き続き漬け丼variantのみ'
          + '（クックパッド等の匿名投稿を除く）。REVIEWを維持する。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tori-soboro-don',
    name: '鶏そぼろ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏ひき肉', amount: '200g' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['丼', '肉', '時短'],
    equipment: ['フライパン', '菜箸'],
    steps: [
      'フライパンに鶏ひき肉、しょうゆ、砂糖、みりんを入れる',
      '中火にかけ、ほぐしながら肉の色が完全に変わるまで炒める',
      'ごはんを丼によそい、そぼろをのせる',
    ],
    notes: ['ひき肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-torisoborodon-2026', 'sirogohan-torisoboro-2026'],
      recipeIdentity: {
        canonicalDish: '鶏そぼろ丼',
        variant: 'みそ・卵を使わないシンプルな3種調味料（しょうゆ・砂糖・みりん）そぼろ',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味',
        coreMethod: '鶏ひき肉を調味料とともにフライパンで炒め煮する（二色丼の卵そぼろは作らない）',
        definingIngredients: ['鶏ひき肉', 'ごはん'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['kikkoman-torisoborodon-2026', 'sirogohan-torisoboro-2026'],
          supportType: 'direct',
        },
        {
          field: 'ingredientAmounts',
          sourceIds: ['kikkoman-torisoborodon-2026', 'sirogohan-torisoboro-2026'],
          supportType: 'direct',
        },
        { field: 'servingsBase', sourceIds: ['kikkoman-torisoborodon-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: 鶏ひき肉200g / SOURCE A: キッコーマン公式(2人分・200g) / SOURCE B: 白ごはん.com(専門家・作りやすい分量・200g) / DECISION: 変更なし / WHY: 両source独立に200gで一致 / EVIDENCE TYPE: direct。',
        'CURRENT: しょうゆ大さじ1と1/2・砂糖大さじ1・みりん大さじ1 / SOURCE A: キッコーマン公式「二色丼」みそ大さじ2+砂糖大さじ2+しょうゆ大さじ1+しょうが汁小さじ2（卵そぼろ別添え、Recipe Identityが異なるためvariant supportのみ）/ SOURCE B: 白ごはん.com（専門家）しょうゆ大さじ3+砂糖大さじ3〜4+酒大さじ1（みそなし、NUKITORUと同じRecipe Identityだが酒でなくみりんを使う点が異なる）/ DECISION: 変更なし（保留） / WHY: SOURCE Bは同一variantで直接比較可能だが、酒→みりんの代替が1:1で成立するという確証がなく、単純平均も禁止されているため、しょうゆ・砂糖を約2倍に引き上げる修正は「未検証のderivation」になってしまう。人間による代替比率の判断が必要なためREVIEW維持 / EVIDENCE TYPE: SOURCE Aはvariant、SOURCE Bはderived候補だが未確定のためNOT_FOUND相当として扱う。',
        '独立した2つの組織（キッコーマン・白ごはん.com）からのsourceは得られているが、鶏ひき肉200gの一致以外はvariant不一致またはderivation未確定のため、Critical Fieldの一部がRESOLVEDにならずVERIFIED不可。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'gyudon',
    name: '牛丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
      { name: '砂糖', amount: '大さじ1' },
      { name: '酒', amount: '100ml' },
    ],
    cookingLiquids: [{ name: '水', amount: '100ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 30,
    servingsBase: 2,
    tags: ['丼', '肉'],
    equipment: ['包丁', 'まな板', '鍋', '丼'],
    steps: [
      '玉ねぎを薄切りにする',
      '鍋にしょうゆ、みりん、砂糖、酒、水を入れて煮立たせる',
      '玉ねぎを加えて煮る',
      '牛肉を加え、色が変わるまで煮る',
      'ごはんを丼によそい、具をのせる',
    ],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocolにより修正。
    // CURRENT: 玉ねぎ1個・みりん大さじ2・酒なし・cookingLiquidsなし(steps「水少々」)・
    // cookingTimeMinutes20分 / SOURCE A: kikkoman-gyudon-2026「基本の牛丼」(2人分)
    // 玉ねぎ1/2個(100g)・みりん大さじ3・料理の清酒1/2カップ(100ml)・水1/2カップ(100ml)・
    // 調理時間約30分 / DECISION: 玉ねぎ1/2個・みりん大さじ3・酒100ml(seasonings新設)・
    // cookingLiquids水100ml・cookingTimeMinutes30分へ変更、steps内「水少々」は構造化
    // フィールドと重複するため「水」に統一 / WHY: キッコーマン公式が牛肉200g・しょうゆ
    // 大さじ2・砂糖大さじ1という一致部分に加え、他の全fieldを具体的数値で明記しており、
    // 現行値より明らかに正確。単一source(独立した第2source未確認)のためVERIFIEDには
    // しないが、値そのものはDIRECT SUPPORTとして採用する / EVIDENCE TYPE: direct。
    // MISSION 2.12 PHASE B — 独立した第2source（白ごはん.com/専門家）を実際に調査。
    // CURRENT: 玉ねぎ1/2個・みりん大さじ3・酒100ml・水100ml / SOURCE B:
    // sirogohan-gyudon-2026「丼もので人気No.1牛丼」(2〜3人分) 牛肉250g・玉ねぎ1/2個
    // (約150g)・しょうゆ大さじ4(60ml)・みりん50ml・砂糖大さじ3・酒50ml・水200ml、
    // 調理時間30分 / DECISION: 変更なし（現状維持） / WHY: SOURCE B（専門家）は
    // Recipe Identity（基本の牛丼・つゆだくでない甘辛煮）はKikkomanと概ね一致するが、
    // 人数比を揃えても砂糖(約3倍)・しょうゆ(約2倍)・水(約2倍)がKikkomanと大きく異なり、
    // 単純平均は禁止されているため、どちらが「正しい」かをAIが決めることはできない /
    // EVIDENCE TYPE: CONFLICT（Kikkoman=direct基準値, sirogohanとの間で数値相違）。
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-gyudon-2026', 'sirogohan-gyudon-2026'],
      recipeIdentity: {
        canonicalDish: '牛丼',
        variant: '基本の牛丼（つゆだくでない、家庭の甘辛煮）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味',
        coreMethod: '牛肉と玉ねぎを、しょうゆ・みりん・砂糖・酒・水の煮汁で煮る',
        definingIngredients: ['牛肉', '玉ねぎ', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kikkoman-gyudon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        {
          field: 'cookingLiquids',
          sourceIds: ['kikkoman-gyudon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        { field: 'cookingTimeMinutes', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.12 PHASE B — 独立した第2source（白ごはん.com、専門家）を実査した結果、'
          + '同じ「基本の牛丼」variantでありながら、砂糖(Kikkoman大さじ1 vs sirogohan大さじ3)・'
          + 'しょうゆ(大さじ2 vs 大さじ4)・水(100ml vs 200ml)がservings差を考慮しても大きく食い違うこと'
          + 'が判明した（詳細はコード内コメント参照）。平均化・どちらか一方の恣意的採用はせず、'
          + '両立場をCONFLICTとして記録しREVIEWを維持する。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再確認した。'
          + 'Kikkoman・sirogohanのどちらも「基本の牛丼」と自称するのみで、cooking-method/'
          + 'sauce-base等の意味のある調理上の次元を明示的に区別していないため、'
          + 'isEstablishedVariant()の条件を満たさない。よってこれは正当なvariantの相違では'
          + 'なく「A. likely true conflict」（同一Recipe Identity・同一variant内の真の'
          + '数値矛盾）として分類する。数値の食い違いだけを理由にvariantを新設しない。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'oyako-don',
    name: '親子丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏肉', amount: '1/2枚（100〜120g）' },
      { name: '卵', amount: '3個' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
    ],
    cookingLiquids: [{ name: '水', amount: '150ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['丼', '肉', '卵'],
    equipment: ['包丁', 'まな板', 'フライパン', '丼'],
    steps: [
      '鶏肉を一口大に切り、玉ねぎを薄切りにする',
      'フライパンにしょうゆ、みりん、水、玉ねぎ、鶏肉を入れて煮る',
      '鶏肉の中心まで火が通ったら、溶き卵を回し入れる',
      '卵が好みの固さになったら火を止め、ごはんにのせる',
    ],
    notes: ['鶏肉は中心まで白く火が通っていることを確認してください。'],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocolにより修正。
    // CURRENT: 鶏肉200g・卵2個・みりん大さじ2・cookingTimeMinutes20分 / SOURCE A:
    // kikkoman-oyakodon-2026「基本の親子丼」(2人分) 鶏もも肉1/2枚(100〜120g)・卵3個・
    // みりん大さじ3・調理時間約15分 / DECISION: 鶏肉「1/2枚（100〜120g）」(source表記の
    // rangeをそのまま維持し、point-selectionを行わない)・卵3個・みりん大さじ3・
    // cookingTimeMinutes15分へ変更 / WHY: しょうゆ大さじ2・玉ねぎ1/2個・水150mlは既に
    // 完全一致しており、キッコーマン公式は責任あるメーカーレシピとして他のfieldも高い
    // 信頼性を持つため採用。鶏肉量は「100〜120g」というsourceのrange表記をそのまま
    // Recipeのamount文字列として保持し、独自の代表値選定は行わない（rangeそのものを
    // そのまま複製しているため、point-selectionを伴うrange supportではなくdirect
    // support として扱う） / EVIDENCE TYPE: direct。
    // MISSION 2.12 PHASE B — 独立した第2/第3sourceを実際に調査。
    // SOURCE B: ajinomoto-oyakodon-2026（味の素パーク公式・2人分）鶏もも肉100g・卵2個・
    // 玉ねぎ1/2個(100g)・しょうゆ大さじ1・みりん大さじ1・砂糖大さじ1/2・水3/4カップ+
    // ほんだし小さじ1、調理時間15分。SOURCE C: sirogohan-oyakodon-2026（専門家・2人分）
    // 鶏もも肉100g・卵4個・玉ねぎ1/8個(だし汁ベースのvariant)・しょうゆ大さじ2〜2.5・
    // みりん大さじ4・だし汁大さじ4・砂糖小さじ2、調理時間20分。
    // DECISION: 変更なし（現状維持） / WHY: 玉ねぎ量・調理時間はKikkomanと一致するが、
    // 卵個数（3個 vs Ajinomoto2個 vs sirogohan4個）・しょうゆ/みりん比率が3source間で
    // 食い違う。特にAjinomoto・sirogohanは「だし（ほんだし/だし汁）＋砂糖」を使う
    // coreMethodであり、Kikkoman/NUKITORUの「だしなし・砂糖なし」のcoreMethodとは
    // 前提が異なるvariantのため、直接比較・平均化はしない / EVIDENCE TYPE:
    // AjinomotoはCONFLICT（同一variant内での卵個数相違）、sirogohanはVARIANT
    // （coreMethod相違＝だし使用の有無）。
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-oyakodon-2026', 'ajinomoto-oyakodon-2026', 'sirogohan-oyakodon-2026'],
      recipeIdentity: {
        canonicalDish: '親子丼',
        variant: '基本の親子丼（つゆだく・だし重ねタイプではない、だし・砂糖を使わない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味、卵はとろとろ半熟',
        coreMethod: '鶏肉・玉ねぎをしょうゆ・みりん・水で煮て、溶き卵でとじる（だし・砂糖は使わない）',
        definingIngredients: ['鶏肉', '卵', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        {
          field: 'seasonings',
          sourceIds: ['kikkoman-oyakodon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kikkoman-oyakodon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        { field: 'cookingLiquids', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        { field: 'cookingTimeMinutes', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.12 PHASE B — 独立した第2source（味の素パーク公式）を実査した結果、'
          + '玉ねぎ量・調理時間はKikkomanと一致する一方、卵個数（Kikkoman/NUKITORU3個 vs '
          + 'Ajinomoto2個）としょうゆ・みりんの比率が食い違うことが判明した。第3source'
          + '（白ごはん.com）はだし汁・砂糖を使う別coreMethodのvariantであり、直接比較の対象外'
          + '（詳細はコード内コメント参照）。平均化・恣意的採用はせずCONFLICTとして記録し'
          + 'REVIEWを維持する。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再分類した。'
          + 'sirogohan/Ajinomotoの「だし＋砂糖を使う」coreMethodは、cooking-method/'
          + 'sauce-base次元でKikkoman/NUKITORUの「だしなし」coreMethodと明確に異なり、'
          + '「C. recipe identity mismatch」（別Recipe Identity。単純な数値conflictではない）'
          + 'として分類する。一方、Kikkoman単独source内の卵個数・しょうゆ/みりん量は、'
          + '同一Recipe Identity内で独立した第2sourceによる裏付けがまだ得られていない状態'
          + 'であり、これはisEstablishedVariant()の条件（意味のある次元＋2独立source or '
          + '権威ある情報源の明示）を満たさないため、正当なvariantとして確立しない。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'natto-gohan',
    name: '納豆ごはん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: '納豆', amount: '1パック' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '小さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['ごはん', '時短', '朝食'],
    equipment: ['茶碗'],
    steps: ['ごはんを茶碗によそう', '納豆にしょうゆを混ぜる', 'ごはんにのせる'],
    verification: {
      status: 'review',
      sourceIds: [],
      recipeIdentity: {
        canonicalDish: '納豆ごはん',
        variant: '付属タレを使わず、しょうゆで代用する場合',
        servingsBasis: 1,
        intendedTasteProfile: '家庭的なしょうゆ味',
        coreMethod: '納豆にしょうゆを混ぜてごはんにのせる',
        definingIngredients: ['納豆', 'ごはん'],
      },
      reviewNotes: [
        'CURRENT: しょうゆ小さじ1 / SOURCE A: （なし） / SOURCE B: （なし） / DECISION: 変更なし（現状維持） / WHY: 「納豆1パックに対してしょうゆ何杯」という代用分量を明記した公的機関・メーカー・専門家によるsourceが再調査でも見つからなかった（和食ごよみ等の個人ブログはヒットしたが、具体的な代用分量の記載はなく、専門家性も明確でないため採用しない）。多くのレシピは納豆付属のタレを使う前提で、しょうゆ代用時の量は「お好みで」とされることが多い / EVIDENCE TYPE: NOT_FOUND。',
        '安全性・アレルギーに関わる問題はないためBLOCKEDにはせず、分量未検証としてREVIEWに留める。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tuna-mayo-don',
    name: 'ツナマヨ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: 'ツナ', amount: '1缶（70g）' },
    ],
    seasonings: [
      { name: 'マヨネーズ', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '小さじ1/2' },
    ],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'マヨネーズ' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['丼', '時短'],
    equipment: ['ボウル', '丼'],
    steps: [
      'ツナの油を軽くきる',
      'ボウルでツナとマヨネーズ、しょうゆを混ぜる',
      'ごはんにのせる',
    ],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocol再監査。
    // D.7-Aで根拠として使ったキユーピー公式X(旧Twitter)投稿は、再監査でWebFetchが
    // HTTP 402で本文を取得できないことが判明した。「Source本文を確認できない」場合は
    // 使用禁止のため、そのSourceに基づく判断（しょうゆの補正）は撤回する。
    // CURRENT: ツナ1缶（サイズ不明）・マヨネーズ大さじ1 / SOURCE A: kewpie-tunamayo-2026
    // 「1/2缶(35g)にマヨネーズ大さじ1・めんつゆ小さじ1、1人分」(本文確認済み) / SOURCE B:
    // seikatuchiebukuro-tuna-can-size-2026「ツナ缶は一般的に1缶70g」(本文確認済み) /
    // DECISION: 「ツナ1缶」を「1缶（70g）」に明記し、マヨネーズを大さじ1→大さじ2へ変更。
    // しょうゆは変更しない（現状維持） / WHY: 缶サイズはSOURCE Bで70gが標準と直接確認済み。
    // マヨネーズは35g→大さじ1という単一の事実を70g(2倍)に比例計算しただけで、
    // マヨネーズという同一製品内の比例のためvariant差の影響を受けない(derived)。
    // 一方、しょうゆについてはSOURCE Aが「めんつゆ」を使用しており、NUKITORUの
    // 「しょうゆ」とは製品variantが異なる（めんつゆは出汁・みりん等で希釈されているため
    // 同じ小さじ数でも塩味の強さが異なり、単純換算できない）。X投稿の「しょうゆ大さじ1/2」
    // という情報は本文確認ができず不採用のため、しょうゆの分量はNOT_FOUNDのまま
    // 変更しない / EVIDENCE TYPE: マヨネーズ=derived、しょうゆ=NOT_FOUND。
    verification: {
      status: 'review',
      sourceIds: ['kewpie-tunamayo-2026', 'seikatuchiebukuro-tuna-can-size-2026'],
      recipeIdentity: {
        canonicalDish: 'ツナマヨ丼',
        variant: 'しょうゆで味を引き締めるツナマヨ（めんつゆ使用ではない）',
        servingsBasis: 1,
        intendedTasteProfile: '家庭的なマヨネーズのコクとしょうゆの塩味',
        coreMethod: 'ツナの油をきり、マヨネーズ・しょうゆと和えてごはんにのせる',
        definingIngredients: ['ツナ', 'マヨネーズ'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['seikatuchiebukuro-tuna-can-size-2026'],
          supportType: 'direct',
        },
        {
          field: 'seasonings',
          sourceIds: ['kewpie-tunamayo-2026'],
          supportType: 'derived',
          derivation:
            'キユーピー公式「1/2缶(35g)にマヨネーズ大さじ1」という直接事実を、缶サイズ70g(2倍)に比例計算してマヨネーズ大さじ2とした。マヨネーズという同一製品内の比例計算のためvariant差の影響を受けない。',
        },
      ],
      reviewNotes: [
        'requiredIngredients/seasoningsの一部（マヨネーズ）はDIRECT/DERIVEDで解決したが、しょうゆの分量はNOT_FOUNDのまま（詳細はコード内コメント参照）。すべてのcritical fieldが解決していないためVERIFIEDにはしない。',
        '独立した第2のsourceとしてseikatuchiebukuro-tuna-can-size-2026（缶サイズ）を追加したが、キユーピー社という単一メーカーへの依存自体は解消していない。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'curry-rice',
    name: 'カレーライス',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '4杯分' },
      { name: '豚肉', amount: '300g' },
      { name: '玉ねぎ', amount: '2個' },
      { name: 'にんじん', amount: '1本' },
      { name: 'じゃがいも', amount: '2個' },
    ],
    seasonings: [{ name: 'カレールー', amount: '1箱（4皿分）' }],
    cookingLiquids: [{ name: '水', amount: '650ml' }],
    ingredientChecks: [{ ingredientName: 'カレールー' }],
    cookingTimeMinutes: 40,
    servingsBase: 4,
    tags: ['煮込み', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'お玉'],
    steps: [
      '玉ねぎ、にんじん、じゃがいも、豚肉を一口大に切る',
      '鍋で豚肉を炒め、色が変わったら玉ねぎ、にんじん、じゃがいもを加えて炒める',
      '水を加えて具材が柔らかくなるまで煮込む',
      '火を止めてカレールーを溶かし入れる',
      '再び弱火にかけ、とろみがつくまで煮る',
      'ごはんを皿に盛り、カレーをかける',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['housefoods-vermont-curry-2026'],
      recipeIdentity: {
        canonicalDish: 'カレーライス',
        variant: '豚肉使用・具だくさん・市販ルー使用（メーカー非指定、「1箱=4皿分」の製品を想定）',
        servingsBasis: 4,
        intendedTasteProfile: '家庭的・子ども向けの甘口〜中辛',
        coreMethod: '豚肉と野菜を炒めてから煮込み、市販ルーで仕上げる',
        definingIngredients: ['豚肉', '玉ねぎ', 'カレールー'],
      },
      fieldVerifications: [
        { field: 'cookingLiquids', sourceIds: ['housefoods-vermont-curry-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: 水650ml・玉ねぎ2個・にんじん1本・じゃがいも2個(4皿分) / SOURCE A: housefoods-vermont-curry-2026「バーモントカレー」基本レシピ6皿分(ルー1/2箱=115g、牛肉250g、玉ねぎ中2個、にんじん中1/2本、じゃがいも中1・1/2個、水850ml) / DECISION: 変更なし（現状維持） / WHY: SOURCE Aを4皿分に比例換算すると水約567ml・玉ねぎ約1.3個・にんじん約1/3本・じゃがいも約1個となり、NUKITORU現行値はすべてこれより多め。しかしSOURCE Aは牛肉ベースでNUKITORUは豚肉ベースという食材差があり、かつ「ルー1/2箱=115g」という特定商品サイズを前提にしているのに対しNUKITORUの「1箱（4皿分）」は商品を特定していないため、Recipe Identity（ルー製品）が異なりVARIANT SUPPORTと判定。単純な比例換算による補正はvariant混同にあたるため採用しない / EVIDENCE TYPE: variant。',
        'カレールーは製品によって「1箱=何皿分」の設計が大きく異なり（ハウス食品の230g箱は今回の基準レシピで実質12皿相当）、特定商品を仮定しない限り水量をVERIFIEDにできない。これはPHASE D.5のProduct Check Alert（カレールー）の設計思想とも整合する。',
        '安全上の問題はないためBLOCKEDにはせず、product-dependentな水量としてREVIEWに留める。',
      ],
      hasUnsupportedInference: true,
    },
  },

  // ------------------------------------------------------------
  // 肉の主菜
  // ------------------------------------------------------------
  {
    id: 'pork-cabbage-miso-stirfry',
    name: '豚肉とキャベツの味噌炒め',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '200g' },
      { name: 'キャベツ', amount: '1/4個' },
    ],
    seasonings: [
      { name: '味噌', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '酒', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['炒め物', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      'キャベツを一口大に切る',
      'フライパンで豚肉を炒め、中心まで色が変わったらキャベツを加える',
      '味噌、砂糖、酒を混ぜたたれを加えて炒め合わせる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['marukawamiso-pork-cabbage-2026', 'delishkitchen-pork-cabbage-2026'],
      recipeIdentity: {
        canonicalDish: '豚肉とキャベツの味噌炒め',
        variant: '汁気のない乾いた炒め物（だし・とろみなし、しめじ/もやし/しょうがを加えない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な味噌のコク',
        coreMethod: '豚肉を炒めてからキャベツを加え、味噌だれで炒め合わせる',
        definingIngredients: ['豚肉', 'キャベツ', '味噌'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['delishkitchen-pork-cabbage-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['delishkitchen-pork-cabbage-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'CURRENT: 豚肉200g・味噌大さじ1・砂糖小さじ1・酒大さじ1 / SOURCE A: delishkitchen-pork-cabbage-2026（2人分・豚肉200g・酒大さじ1・砂糖小さじ1・みそ大さじ1と1/2、Recipe Identityがほぼ同一のvariant）/ SOURCE B: marukawamiso-pork-cabbage-2026（味噌メーカー公式・4人前・だし200cc/しめじ/もやし/しょうが入りの「汁気のある」別variant）/ DECISION: 変更なし（現状維持） / WHY: SOURCE Aは豚肉・砂糖・酒が完全一致し味噌もほぼ近い（大さじ1 vs 1と1/2）ため現行値は妥当な範囲内。SOURCE Bは具材構成が異なる別Recipe Identityのためvariant supportに留め、比較対象にしない / EVIDENCE TYPE: SOURCE Aはdirect、SOURCE Bはvariant。',
        'SOURCE A（DELISH KITCHEN）は運営体制上「専門家監修」の明記がなくother-trusted相当のため、同一variantでのTier1/2 sourceによる独立裏付けにはまだ至っていない。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tori-teriyaki',
    name: '鶏の照り焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '鶏肉', amount: '300g' }],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物', '子ども向け'],
    equipment: ['フライパン', '菜箸'],
    steps: [
      'フライパンで鶏肉の皮目から焼く',
      '両面に焼き色がつき、中心まで火が通ったら余分な油をふき取る',
      'しょうゆ、みりん、砂糖を加えて煮からめる',
    ],
    notes: ['鶏肉は中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'buta-shogayaki',
    name: '豚の生姜焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1' },
      { name: 'しょうが', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      '玉ねぎを薄切りにする',
      'フライパンで豚肉と玉ねぎを炒める',
      '豚肉の中心まで色が変わったら、しょうゆ、みりん、しょうがを加えてからめる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
  },
  {
    id: 'nikujaga',
    name: '肉じゃが',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '牛肉', amount: '200g' },
      { name: 'じゃがいも', amount: '3個' },
      { name: 'にんじん', amount: '1本' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ2' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '350ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 30,
    servingsBase: 3,
    tags: ['煮込み', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'じゃがいも、にんじん、玉ねぎを一口大に切る',
      '鍋で牛肉を炒め、色が変わったら野菜を加えて炒める',
      '水、しょうゆ、みりん、砂糖を加える',
      '具材が柔らかくなるまで煮る',
    ],
  },
  {
    id: 'mabo-tofu',
    name: '麻婆豆腐',
    type: 'main',
    cuisine: 'chinese',
    requiredIngredients: [
      { name: '豆腐', amount: '1丁' },
      { name: '豚ひき肉', amount: '150g' },
    ],
    seasonings: [
      { name: '味噌', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: '豆板醤', amount: '小さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '100ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: '味噌' },
      { ingredientName: '豆板醤' },
    ],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['中華', '辛め'],
    equipment: ['フライパン', 'まな板', '包丁'],
    steps: [
      '豆腐を一口大に切る',
      'フライパンで豚ひき肉を中心まで色が変わるまで炒める',
      '味噌、しょうゆ、豆板醤を加えて炒め合わせる',
      '豆腐と水を加えて軽く煮る',
    ],
    notes: ['ひき肉は中心まで色が変わっていることを確認してください。'],
    arrangements: [{ id: 'mabo-tofu-negi', label: '仕上げにねぎを散らす', addIngredients: ['ねぎ'] }],
  },
  {
    id: 'tori-karaage',
    name: '鶏の唐揚げ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '鶏肉', amount: '300g' },
      { name: '片栗粉', amount: '大さじ3' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'しょうが', amount: '小さじ1' },
      { name: '油', amount: '適量（揚げ油）' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 25,
    servingsBase: 2,
    tags: ['揚げ物', '子ども向け'],
    equipment: ['包丁', 'まな板', 'ボウル', 'フライパンまたは鍋', 'バット'],
    steps: [
      '鶏肉を一口大に切り、しょうゆとしょうがに漬け込む',
      '片栗粉をまぶす',
      '油で揚げ、中心まで火が通るまで加熱する',
      '油をきってバットに取り出す',
    ],
    notes: ['鶏肉は切って中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'gyuniku-tamanegi-itame',
    name: '牛肉と玉ねぎの炒め物',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['炒め物', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      '玉ねぎを薄切りにする',
      'フライパンで牛肉と玉ねぎを炒める',
      '牛肉の色が変わったら、しょうゆと砂糖を加えて炒め合わせる',
    ],
  },

  // ------------------------------------------------------------
  // 魚の主菜
  // ------------------------------------------------------------
  {
    id: 'sake-meuniere',
    name: '鮭のムニエル',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '鮭', amount: '2切れ' },
      { name: '小麦粉', amount: '大さじ2' },
    ],
    seasonings: [
      { name: '塩', amount: '小さじ1/2' },
      { name: 'こしょう', amount: '少々' },
      { name: 'バター', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物'],
    equipment: ['フライパン', 'バット'],
    steps: [
      '鮭に塩こしょうをして小麦粉を薄くまぶす',
      'フライパンにバターを熱し、鮭を並べる',
      '両面をこんがり焼き、中心まで火を通す',
    ],
    notes: ['鮭は中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'saba-misoni',
    name: 'サバの味噌煮',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'サバ', amount: '2切れ' }],
    seasonings: [
      { name: '味噌', amount: '大さじ2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: 'しょうが', amount: '1かけ' },
      { name: '酒', amount: '大さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '200ml' }],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['煮物'],
    equipment: ['フライパンまたは鍋'],
    steps: [
      '鍋に水、酒、しょうがを入れて煮立たせる',
      'サバを入れて中火で煮る',
      '味噌と砂糖を溶き入れ、煮汁をかけながらさらに煮る',
      '中心まで火が通ったら完成',
    ],
    notes: ['サバは中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'sake-shioyaki',
    name: '鮭の塩焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '鮭', amount: '1切れ' }],
    seasonings: [{ name: '塩', amount: '少々' }],
    cookingTimeMinutes: 8,
    servingsBase: 1,
    tags: ['焼き物', '時短'],
    equipment: ['フライパンまたはグリル'],
    steps: ['鮭に軽く塩をふる', 'グリルまたはフライパンで両面を焼く', '中心まで火が通ったら完成'],
    notes: ['鮭は中心まで火が通っていることを確認してください。'],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: cookingTimeMinutes=15分 / SOURCE A: oishikenko-sakeshioyaki-2026
    // （管理栄養士監修・1人分）鮭1切れ(70g)・塩0.6g、グリルまたはトースターで7〜8分 /
    // SOURCE B: kikkoman-sakeyakikata-2026（キッコーマン公式）フライパン(油+酒使用・
    // ふた使用)で4〜5分、両面グリルで4分+余熱3分、片面グリルで3分+2〜3分 /
    // DECISION: 15分→8分へ変更 / WHY: 2つの独立したsource（Tier3専門家＋Tier2メーカー）
    // がいずれも15分よりはるかに短い4〜8分の範囲を示しており、現行の15分は明確に長すぎる
    // と判断できる。ただしSOURCE間で調理法（油・酒・ふた使用の有無）が異なりEvidence Fact
    // 自体は単一のexact値ではなくrange（約4〜8分）であるため、rangeの中央値等を無言で
    // exact化せず、NUKITORUの調理法（油・酒を使わない基本のグリル/フライパン）に最も近い
    // SOURCE A（無油・グリルまたはトースター・7〜8分）の上限値をProduct Decisionとして
    // 採用し、安全側（生焼け防止）に倒す / EVIDENCE TYPE: cookingTimeMinutes=range。
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-sakeyakikata-2026', 'oishikenko-sakeshioyaki-2026'],
      recipeIdentity: {
        canonicalDish: '鮭の塩焼き',
        variant: '油・酒・ふたを使わない基本の塩焼き（下味用の1%塩＋化粧塩等の凝った下処理はしない）',
        servingsBasis: 1,
        intendedTasteProfile: '素材の味を活かした、塩のみのシンプルな塩焼き',
        coreMethod: '鮭に塩をふり、フライパンまたはグリルで両面を焼く（油・酒・ふたなし）',
        definingIngredients: ['鮭'],
        // MISSION 2.13 — Evidence Variant Foundation。kikkoman-sakeyakikata-2026自身が
        // 「フライパン法（油・酒・ふた使用）」と「グリル法（無油）」を明確に別セクション
        // として提示しており（1件の権威ある情報源がそれ自体でvariantを明示する例）、
        // isEstablishedVariant()の条件を満たす正当なvariantとして確立できる。NUKITORUの
        // 現在の調理法（油・酒を使わない）はこのうち「グリル法」variantに一致するため、
        // そちらへ紐付ける（isRecipePublishable()の判定には一切影響しない。純粋な
        // 分類メタデータ）。
        variantIdentity: {
          variantId: 'sake-shioyaki-grill-no-oil',
          canonicalDishId: 'sake-shioyaki',
          label: 'グリル/トースター法（無油）',
          preparationStyle: 'グリルまたはトースターで、油を使わず焼く',
          definingCharacteristics: [
            '油を使わない（無油）',
            'フライパン+油+酒+ふたによる蒸し焼き方式ではない',
          ],
        },
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['kikkoman-sakeyakikata-2026', 'oishikenko-sakeshioyaki-2026'],
          supportType: 'range',
          derivation:
            'Evidence Factは調理法により4〜8分というrangeのみ（フライパン+油+酒:4〜5分／グリル両面:4分+余熱3分／グリル片面:3分+2〜3分／グリルまたはトースター無油:7〜8分）。Recipeのcookingtime=8分はこのrangeから選んだ代表値であり、Evidence直接支持ではなくProduct Decision（下記productDecisions参照）。',
          evidenceRange: { min: 4, max: 8, unit: '分' },
          // MISSION 2.13 — 「グリル法」variant内でもoishi-kenkoの7〜8分という幅は残る
          // ため、variantを確立してもrangeがexact Evidenceに変わるわけではない
          // （Section 8: Range remains independent from Variant）。
          variantRelation: 'variant-specific',
          variantId: 'sake-shioyaki-grill-no-oil',
        },
        { field: 'servingsBase', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        { field: 'criticalSteps', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        {
          field: 'equipment',
          sourceIds: ['oishikenko-sakeshioyaki-2026'],
          supportType: 'variant',
          variantRelation: 'variant-specific',
          variantId: 'sake-shioyaki-grill-no-oil',
        },
        { field: 'allergyIdentity', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
      ],
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '8分',
          reason:
            '調理法によりEvidence Factが4〜8分のrangeであるため、NUKITORUの油・酒を使わない'
              + '基本のグリル/フライパン調理法に最も近いSOURCE A（無油・グリルまたはトースター）'
              + 'の上限値7〜8分のうち、生焼け防止の観点から安全側の8分を代表値として採用した。',
          referenceSourceIds: ['oishikenko-sakeshioyaki-2026'],
        },
      ],
      reviewNotes: [
        'cookingTimeMinutesのEvidence FactはrangeであるためCritical Fieldが未解決（PHASE '
          + 'D.7-B.1のEvidence Range Integrity Fixに準拠）。equipmentもSOURCE Aは'
          + 'グリル/トースターのみを扱いフライパンでの無油調理は直接検証していないため'
          + 'variant扱いとした。他のfield（食材・分量・調味料・人数・工程）はdirectで解決済み。',
        'MISSION 2.13 — Evidence Variant Foundation。kikkoman-sakeyakikata-2026自身が'
          + '「フライパン法（油・酒・ふた使用）」「グリル法（無油）」を明示的に別methodとして'
          + '提示しており、これはisEstablishedVariant()の条件（cooking-method次元＋1件の'
          + '権威ある情報源による明示）を満たす正当なvariantである（「B. likely legitimate '
          + 'variant」）。NUKITORUの現在のrecipeIdentity.variantIdentityは「グリル法（無油）」'
          + 'へ紐付けたが、それでもcookingTimeMinutesはこのvariant内部でも7〜8分という幅が'
          + '残るためrangeのまま（variantの確立はrangeをexact Evidenceに変えない）。また'
          + 'NUKITORUの現在のequipmentフィールドは「フライパンまたはグリル」と2つの'
          + 'variantを1つのfieldへ併記しており、Section 11「Do not merge values across '
          + 'variants into one synthetic recipe」の観点では将来的に一方へ確定させるか、'
          + '両variantを別々にEvidence裏付けする必要がある、という設計上の課題として記録する'
          + '（本ミッションではrecipe fact自体は変更しない）。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'maguro-yamakake',
    name: 'まぐろの山かけ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'マグロ', amount: '150g' },
      { name: '長芋', amount: '150g' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['生食', '時短'],
    equipment: ['包丁', 'まな板', 'おろし器'],
    steps: [
      '長芋の皮をむき、すりおろす',
      'マグロを食べやすい大きさに切る',
      '器にマグロを盛り、長芋をかける',
      'しょうゆをかける',
    ],
    notes: ['生食用として販売されている魚を使用してください。'],
  },
  {
    id: 'tuna-daikon-salad',
    name: 'ツナと大根のサラダ',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ツナ', amount: '1缶' },
      { name: '大根', amount: '1/4本' },
    ],
    seasonings: [{ name: 'マヨネーズ', amount: '大さじ2' }],
    ingredientChecks: [{ ingredientName: 'マヨネーズ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['サラダ', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['大根を千切りにする', 'ツナの油を軽くきる', 'ボウルで大根、ツナ、マヨネーズを和える'],
  },

  // ------------------------------------------------------------
  // 卵・豆腐系
  // ------------------------------------------------------------
  {
    id: 'medama-yaki',
    name: '目玉焼き',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '1個' }],
    seasonings: [{ name: '油', amount: '小さじ1と1/2' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短', '子ども向け'],
    equipment: ['フライパン'],
    steps: ['フライパンに油を熱する', '卵を割り入れる', '好みの固さになるまで焼く'],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 油 小さじ1 / SOURCE A: kyounoryouri-medamayaki-2026（NHKみんなのきょうの
    // 料理・瀬田金行シェフ監修、2人分）卵2個・サラダ油大さじ1・調理時間10分（1個ずつ
    // 順に焼く方式）/ SOURCE B: kikkoman-medamayaki-tips-2026（キッコーマン公式）
    // 油少々・弱火で3〜4分 / DECISION: 油を小さじ1→小さじ1と1/2へ変更 / WHY: SOURCE Aの
    // 「2個で大さじ1」を卵1個あたりへ機械的に等分（大さじ1/2＝小さじ1と1/2）。卵の個数と
    // 油の量は同一調理法内で線形に扱って妥当（片面焼きのまま個数だけが変わる）。SOURCE B
    // の「油少々」は数値化されていないが小さじ1と1/2という少量と矛盾しない。
    // cookingTimeMinutesは変更なし（5分） / WHY: SOURCE Aの卵1個あたりの実質加熱時間は
    // 本文「弱めの中火で3分ほど」+初期の予熱・卵を割り入れる時間を合わせて5分程度が妥当な
    // 範囲であり、SOURCE Bの「3〜4分」（弱火加熱のみ、予熱等含まず）とも整合する。
    // どちらのSourceも複数の異なる調理器具・条件によるrangeを示しているわけではなく、
    // 単一の調理法の中での近似のため、rangeとしてではなくderivedとして扱う /
    // EVIDENCE TYPE: 油=derived、cookingTimeMinutes=derived、その他=direct。
    verification: {
      status: 'verified',
      sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
      recipeIdentity: {
        canonicalDish: '目玉焼き',
        variant: '片面焼き・水を使わない基本の目玉焼き（蒸し焼きバージョンではない）',
        servingsBasis: 1,
        intendedTasteProfile: '黄身が半熟〜好みの固さの、シンプルな塩味なしの目玉焼き（油と卵のみ）',
        coreMethod: 'フライパンに油を熱し、卵を割り入れて水を使わず好みの固さまで焼く',
        definingIngredients: ['卵'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'direct',
        },
        {
          field: 'ingredientAmounts',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'derived',
          derivation: 'NHK「2人分・卵2個」＝1人分1個という1:1の卵数比率をそのまま適用。',
        },
        {
          field: 'seasonings',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
          supportType: 'direct',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'derived',
          derivation:
            'NHK「2個でサラダ油大さじ1」を卵1個あたりへ機械的に等分（大さじ1/2＝小さじ1と1/2）。キッコーマンの「油少々」はこの少量と矛盾しない。',
        },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
          supportType: 'derived',
          derivation:
            'NHKの卵1個あたりの加熱記述（弱めの中火で3分ほど）＋予熱・卵を割り入れる工程を合わせ5分程度。キッコーマンの「弱火3〜4分」（加熱のみ）とも整合する近似値。',
        },
        {
          field: 'servingsBase',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'derived',
          derivation: 'NHK「2人分・卵2個」から、卵1個＝1人分という比率を採用。',
        },
        {
          field: 'criticalSteps',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
          supportType: 'direct',
        },
        { field: 'equipment', sourceIds: ['kyounoryouri-medamayaki-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['kyounoryouri-medamayaki-2026'], supportType: 'direct' },
      ],
      reviewNotes: [],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'tamagoyaki',
    name: '卵焼き',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '3個' }],
    seasonings: [
      { name: '砂糖', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
      { name: '油', amount: '適量' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['朝食', '子ども向け'],
    equipment: ['卵焼き用フライパン', '菜箸', '包丁', 'まな板'],
    steps: [
      '卵を溶き、砂糖としょうゆを混ぜる',
      'フライパンに薄く油をひき、卵液を少量流し入れて焼く',
      '端から巻きながら残りの卵液も同様に焼き重ねる',
      '中心まで火が通ったら取り出して切る',
    ],
  },
  {
    id: 'tofu-tamago-soup',
    name: '豆腐と卵のスープ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '卵', amount: '1個' },
      { name: '豆腐', amount: '1/2丁' },
    ],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせる',
      '豆腐を一口大に切って加える',
      'しょうゆで味を調える',
      '溶き卵を回し入れ、卵に火が通ったら火を止める',
    ],
  },
  {
    id: 'hiyayakko',
    name: '冷奴',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '豆腐', amount: '1/2丁' }],
    seasonings: [{ name: 'しょうゆ', amount: '小さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['時短', '夏'],
    equipment: ['包丁', 'まな板'],
    steps: ['豆腐を食べやすい大きさに切る', '器に盛り、しょうゆをかける'],
    arrangements: [
      { id: 'hiyayakko-negi', label: 'ねぎをのせる', addIngredients: ['ねぎ'] },
      { id: 'hiyayakko-katsuobushi', label: 'かつお節をのせる', addIngredients: ['かつお節'] },
    ],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 豆腐1/2丁(1人分)・しょうゆ小さじ1 / SOURCE A: ajinomoto-hiyayakko-2026
    // （味の素パーク公式）絹ごし豆腐1丁・4人分、しょうゆは「適量」（数値なし）/
    // DECISION: 変更なし（現状維持） / WHY: 豆腐の人数比はSOURCE A（1丁/4人＝1/4丁/人）と
    // NUKITORU（1/2丁/1人）で2倍の開きがあるが、豆腐ブロックのサイズ・銘柄自体が製品により
    // 大きく異なるため、比率の一致・不一致だけで結論を出せない。しょうゆはSOURCE Aを含め
    // 調査した複数のメーカー公式・専門家サイトのいずれも「適量」表記でありexactな標準比率
    // が存在しない（お好みで量を調整する調味料であるため）/ EVIDENCE TYPE: 豆腐量=CONFLICT
    // （製品サイズ差の可能性があり結論不能）、しょうゆ=NOT_FOUND。
    verification: {
      status: 'review',
      sourceIds: ['ajinomoto-hiyayakko-2026'],
      recipeIdentity: {
        canonicalDish: '冷奴',
        variant: '基本の冷奴（薬味なし、しょうゆのみ）',
        servingsBasis: 1,
        intendedTasteProfile: '豆腐そのものの味を活かした、しょうゆのみのシンプルな冷奴',
        coreMethod: '豆腐を切って器に盛り、しょうゆをかける（加熱調理なし）',
        definingIngredients: ['豆腐'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['ajinomoto-hiyayakko-2026'], supportType: 'variant' },
        { field: 'criticalSteps', sourceIds: ['ajinomoto-hiyayakko-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'CURRENT: 豆腐1/2丁(1人分) / SOURCE A: ajinomoto-hiyayakko-2026（絹ごし豆腐1丁・'
          + '4人分＝1/4丁/人）/ DECISION: 変更なし（現状維持） / WHY: 豆腐1丁の重量は製品'
          + 'により大きく異なり（300g〜400g等）、比率の単純比較では結論できない。同一製品を'
          + '仮定しない限り解決不能なためCONFLICT扱いのままREVIEWとする / EVIDENCE TYPE: '
          + 'CONFLICT。',
        'CURRENT: しょうゆ小さじ1 / SOURCE A: 「適量」（数値なし）/ DECISION: 変更なし / '
          + 'WHY: 調査した複数のメーカー公式サイトがいずれも「適量」表記で、しょうゆの'
          + 'exact標準量を明記した信頼できるsourceが見つからなかった（お好みで調整する'
          + '調味料であるため） / EVIDENCE TYPE: NOT_FOUND。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再分類する。'
          + '豆腐量については、対立する2件の独立sourceが存在するわけではなく、根拠のある'
          + 'source（Ajinomoto、1/4丁/人）とNUKITORU側の無根拠な既存値（1/2丁/人）の'
          + '食い違いに過ぎないため、PHASE Bの「CONFLICT」表記は精度を欠いていた。'
          + '正しくは「E. NOT_FOUND/under-specified」（豆腐1丁の重量が製品により大きく'
          + '異なるため、特定製品を仮定しない限り根拠のあるratioを確定できない）として'
          + '再分類する。しょうゆ量も同様にE（推測禁止・確定不能）。isEstablishedVariant()'
          + 'の条件（意味のある次元＋複数独立source or 権威ある情報源の明示）を満たさない'
          + 'ため、variantとしても確立しない。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'iritamago',
    name: '炒り卵',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '2個' }],
    seasonings: [
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
    ],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['フライパン', '菜箸'],
    steps: [
      '卵を溶き、砂糖と塩を混ぜる',
      'フライパンで弱火にかけながら菜箸でかき混ぜる',
      '好みの固さになったら火を止める',
    ],
  },

  // ------------------------------------------------------------
  // 副菜
  // ------------------------------------------------------------
  {
    id: 'ninjin-shirishiri',
    name: 'にんじんしりしり',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'にんじん', amount: '1本' },
      { name: '卵', amount: '1個' },
    ],
    seasonings: [
      { name: '油', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      'にんじんを細切りにする',
      'フライパンで油を熱し、にんじんを炒める',
      'しんなりしたら溶き卵を加えて炒め合わせる',
    ],
  },
  {
    id: 'kinoko-butter-itame',
    name: 'きのこのバター炒め',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'きのこ', amount: '200g' }],
    seasonings: [
      { name: 'バター', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短'],
    equipment: ['フライパン'],
    steps: ['きのこを食べやすい大きさにほぐす', 'フライパンでバターを熱し、きのこを炒める', 'しょうゆで味を調える'],
  },
  {
    id: 'jagaimo-nikkorogashi',
    name: 'じゃがいもの煮っころがし',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'じゃがいも', amount: '3個' }],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['副菜', '煮物'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'じゃがいもを一口大に切る',
      '鍋にじゃがいもと具材が浸る程度の水を入れて火にかける',
      '柔らかくなってきたらしょうゆ、みりん、砂糖を加える',
      '煮汁が少なくなるまで煮詰める',
    ],
  },
  {
    id: 'daikon-asazuke',
    name: '大根の浅漬け',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '大根', amount: '1/4本' }],
    seasonings: [
      { name: '塩', amount: '小さじ1/2' },
      { name: '酢', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['大根を薄切りにする', 'ボウルに大根、塩、酢を入れて軽く揉む', '10分ほどおいて味をなじませる'],
  },
  {
    id: 'cabbage-asazuke',
    name: 'キャベツの浅漬け',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'キャベツ', amount: '1/4個' }],
    seasonings: [{ name: '塩', amount: '小さじ1/2' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['キャベツを一口大にちぎる', 'ボウルに入れ、塩を振って軽く揉む', '10分ほどおいて味をなじませる'],
  },
  {
    id: 'ninjin-glace',
    name: 'にんじんのグラッセ',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'にんじん', amount: '1本' }],
    seasonings: [
      { name: 'バター', amount: '大さじ1' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['副菜', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'にんじんを食べやすい大きさに切る',
      '鍋ににんじん、バター、砂糖、ひたる程度の水を入れて煮る',
      '柔らかくなり、水分が少なくなるまで煮詰める',
    ],
  },

  // ------------------------------------------------------------
  // 汁物
  // ------------------------------------------------------------
  {
    id: 'tofu-miso-soup',
    name: '豆腐の味噌汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '豆腐', amount: '1/2丁' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: '味噌', amount: '大さじ1と1/2' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: '味噌' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせる',
      '豆腐を一口大に切って加える',
      '煮立ったら火を弱め、味噌を溶き入れる',
    ],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 水400ml・味噌大さじ1と1/2(2人分) / SOURCE A: yamaki-misoshiru-2026
    // （ヤマキ公式・2人分）だし400ml・味噌大さじ2・具は油揚げ1/2枚+乾燥わかめ+長ねぎ
    // （豆腐は使わない）/ SOURCE B: marukome-misoshiru-faq-2026（マルコメ公式FAQ）
    // 1杯あたり味噌大さじ1(17g):お湯160ccが目安 / DECISION: 変更なし（現状維持） /
    // WHY: 水量400mlはSOURCE Aと一致するが、SOURCE Aは豆腐ではなく油揚げを使う別の
    // definingIngredientのvariantであり、直接比較の対象にできない。一方、味噌:水の
    // 比率で見るとSOURCE B（2人分換算で大さじ2:320ml、約160ml/大さじ1）とSOURCE A
    // （2人分で大さじ2:400ml、約200ml/大さじ1）はメーカー間で比率自体が食い違っており、
    // 平均化は禁止されているため水量400mlをVERIFIEDの根拠にはできない /
    // EVIDENCE TYPE: cookingLiquids(水)=CONFLICT（メーカー間の味噌:水比率相違）、
    // requiredIngredients(豆腐)=SOURCE Aとの関係ではVARIANT（具材が油揚げで異なる）。
    verification: {
      status: 'review',
      sourceIds: ['yamaki-misoshiru-2026', 'marukome-misoshiru-faq-2026'],
      recipeIdentity: {
        canonicalDish: '味噌汁',
        variant: '豆腐のみを具とする味噌汁（油揚げ・わかめ・ねぎ等は加えない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的なだし＋味噌のシンプルな味噌汁',
        coreMethod: '水とだしの素を煮立て、豆腐を加えてから味噌を溶き入れる',
        definingIngredients: ['豆腐', '味噌'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['yamaki-misoshiru-2026'], supportType: 'variant' },
        {
          field: 'cookingLiquids',
          sourceIds: ['yamaki-misoshiru-2026', 'marukome-misoshiru-faq-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
      ],
      reviewNotes: [
        'CURRENT: 水400ml・味噌大さじ1と1/2 / SOURCE A: ヤマキ公式（2人分・だし400ml・'
          + '味噌大さじ2、ただし具は油揚げでありNUKITORUの豆腐とはdefiningIngredientが'
          + '異なるvariant）/ SOURCE B: マルコメ公式FAQ（1杯＝大さじ1:160cc、2人分換算で'
          + '大さじ2:320ml）/ DECISION: 変更なし / WHY: ヤマキとマルコメで味噌:水の比率'
          + '自体が異なり（200ml/大さじ vs 160ml/大さじ）、平均化は禁止されているため'
          + '水400mlをEvidence直接支持として採用できない。CONFLICTとしてREVIEWを維持する '
          + '/ EVIDENCE TYPE: CONFLICT。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らすと、本Recipeには'
          + '性質の異なる2つの問題が混在している。(1) 具材（豆腐 vs ヤマキの油揚げ）は'
          + 'major-ingredient-structureが異なる「C. recipe identity mismatch」。'
          + '(2) 味噌:水比率（ヤマキ200ml/大さじ vs マルコメ160ml/大さじ）は、具材に'
          + '依存しないはずの一般的比率でありながらメーカー間で食い違う「A. likely true '
          + 'conflict」（variant-independentなfieldでのconflict）。いずれもisEstablishedVariant()'
          + 'の条件を満たさずvariantとして確立しないため、数値を選ばずREVIEWを維持する。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'vegetable-soup',
    name: '野菜スープ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'キャベツ', amount: '1/4個' },
      { name: 'にんじん', amount: '1/2本' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [{ name: 'コンソメ', amount: '1個（固形）' }],
    cookingLiquids: [{ name: '水', amount: '600ml' }],
    ingredientChecks: [{ ingredientName: 'コンソメ' }],
    cookingTimeMinutes: 20,
    servingsBase: 3,
    tags: ['汁物', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'キャベツ、にんじん、玉ねぎを食べやすい大きさに切る',
      '鍋に切った野菜と水、コンソメを入れて煮る',
      '野菜が柔らかくなるまで煮込む',
    ],
  },
  {
    id: 'tonjiru',
    name: '豚汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '150g' },
      { name: '大根', amount: '1/4本' },
      { name: 'にんじん', amount: '1/2本' },
    ],
    seasonings: [{ name: '味噌', amount: '大さじ2' }],
    cookingLiquids: [{ name: '水', amount: '600ml' }],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 25,
    servingsBase: 3,
    tags: ['汁物'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      '豚肉、大根、にんじんを一口大に切る',
      '鍋で豚肉を炒め、色が変わったら大根とにんじんを加えて炒める',
      '水を加えて具材が柔らかくなるまで煮る',
      '火を弱めて味噌を溶き入れる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
  },
  {
    id: 'jagaimo-potage',
    name: 'じゃがいものポタージュ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'じゃがいも', amount: '2個' },
      { name: '玉ねぎ', amount: '1/2個' },
      { name: '牛乳', amount: '200ml' },
    ],
    seasonings: [{ name: 'コンソメ', amount: '1個（固形）' }],
    cookingLiquids: [{ name: '水', amount: '300ml' }],
    ingredientChecks: [{ ingredientName: 'コンソメ' }],
    cookingTimeMinutes: 25,
    servingsBase: 3,
    tags: ['汁物', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'マッシャーまたはミキサー'],
    steps: [
      'じゃがいもと玉ねぎを薄切りにする',
      '鍋で炒め、水とコンソメを加えて柔らかくなるまで煮る',
      '粗熱をとってつぶすかミキサーにかける',
      '牛乳を加えて温める',
    ],
  },
  {
    id: 'kakitama-jiru',
    name: 'かきたま汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '1個' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
      { name: '片栗粉', amount: '小さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える',
      '片栗粉を同量の水で溶き、鍋に加えてとろみをつける',
      '溶き卵を回し入れ、卵に火が通ったら火を止める',
    ],
  },

  // ------------------------------------------------------------
  // 麺
  // ------------------------------------------------------------
  {
    id: 'shoyu-udon',
    name: '醤油うどん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'うどん', amount: '1玉' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '350ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['麺', '時短'],
    equipment: ['鍋'],
    steps: ['鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える', 'うどんを加えて温める'],
  },
  {
    id: 'niku-udon',
    name: '肉うどん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'うどん', amount: '2玉' },
      { name: '豚肉', amount: '100g' },
    ],
    seasonings: [
      { name: 'だしの素', amount: '小さじ2' },
      { name: 'しょうゆ', amount: '大さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '700ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['麺'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える',
      '豚肉を加えて中心まで色が変わるまで煮る',
      'うどんを加えて温める',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    arrangements: [{ id: 'niku-udon-negi', label: 'ねぎをのせる', addIngredients: ['ねぎ'] }],
  },
  {
    id: 'napolitan',
    name: 'ナポリタン',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パスタ', amount: '160g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'ケチャップ', amount: '大さじ4' },
      { name: '油', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['麺', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'フライパン'],
    steps: [
      'パスタを表示時間通りにゆでる',
      '玉ねぎを薄切りにする',
      'フライパンで玉ねぎを炒め、ゆでたパスタを加える',
      'ケチャップを加えて炒め合わせる',
    ],
  },
  {
    id: 'kinoko-pasta',
    name: 'きのこパスタ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パスタ', amount: '160g' },
      { name: 'きのこ', amount: '150g' },
    ],
    seasonings: [
      { name: 'オリーブオイル', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '小さじ2' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['麺', '時短'],
    equipment: ['鍋', 'フライパン'],
    steps: [
      'パスタを表示時間通りにゆでる',
      'きのこを食べやすい大きさにほぐす',
      'フライパンでオリーブオイルときのこを炒める',
      'ゆでたパスタとしょうゆを加えて和える',
    ],
  },

  // ------------------------------------------------------------
  // 朝食・軽食
  // ------------------------------------------------------------
  {
    id: 'butter-toast',
    name: 'バタートースト',
    type: 'other',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'パン', amount: '1枚' }],
    seasonings: [{ name: 'バター', amount: '適量' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['トースター'],
    steps: ['パンをトースターで焼く', 'バターを塗る'],
  },
  {
    id: 'tamago-kake-gohan',
    name: '卵かけごはん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: '卵', amount: '1個' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '少々' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['茶碗'],
    steps: ['ごはんを茶碗によそう', '卵を割り入れる', 'しょうゆをかけて混ぜる'],
  },
  {
    id: 'tuna-sandwich',
    name: 'ツナサンド',
    type: 'other',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パン', amount: '2枚' },
      { name: 'ツナ', amount: '1/2缶' },
    ],
    seasonings: [{ name: 'マヨネーズ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'マヨネーズ' }],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['包丁', 'まな板'],
    steps: ['ツナの油を軽くきり、マヨネーズと混ぜる', 'パンにはさむ', '食べやすい大きさに切る'],
  },
]

/** MISSION 2.11 PHASE D — Recipe Detail画面が、MealSuggestion.recipeIdから元のRecipeを再検索するために使う */
export function getRecipeById(id: string): Recipe | undefined {
  return RECIPE_CATALOG.find((recipe) => recipe.id === id)
}
