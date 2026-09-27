import type { DishCategory } from "@prisma/client";

// СЭС бекітетін екі апталық циклдік мәзірдің үлгісі (14 күн): мектеп пен балабақша бөлек.
// Негізгі өнім жеткізуші партиясындағы өніммен салыстырылады: «Сиыр еті» орнына «Шұжық» келсе — алерт.
// Тағамдар мен граммдар — демо үшін үлгі, нақты мәзірді СЭС пен білім бөлімі бекітеді.

export type PlanDish = { name: string; category: DishCategory; portionG: number; main: string; composition: string };

const soup = (name: string, main: string, composition: string, portionG = 250): PlanDish => ({ name, category: "SOUP", portionG, main, composition });
const dish = (name: string, composition: string, portionG = 220, main = "Сиыр еті"): PlanDish => ({ name, category: "MAIN", portionG, main, composition });
const compote: PlanDish = { name: "Жеміс компоты", category: "COLD", portionG: 200, main: "Алма", composition: "Кептірілген алма 20 г, қант 10 г, су 190 г" };
const tea: PlanDish = { name: "Лимонды шай", category: "HOT_DRINK", portionG: 200, main: "Шай", composition: "Қара шай 1 г, лимон 7 г, қант 10 г, су 200 г" };
const cocoa: PlanDish = { name: "Сүтті какао", category: "HOT_DRINK", portionG: 200, main: "Сүт", composition: "Сүт 150 г, какао 4 г, қант 10 г, су 50 г" };

const chickenSoup = soup("Кеспе қосылған тауық сорпасы", "Тауық еті", "Тауық еті 40 г, кеспе 20 г, картоп 60 г, сәбіз 15 г, пияз 10 г");
const vegSoup = soup("Көкөніс сорпасы", "Картоп", "Картоп 90 г, қырыққабат 40 г, сәбіз 15 г, пияз 10 г, өсімдік майы 5 г");
const fishSoup = soup("Балық сорпасы", "Каспий балығы", "Каспий балығы 50 г, картоп 80 г, сәбіз 15 г, пияз 10 г");
const borscht = soup("Борщ", "Картоп", "Қызылша 50 г, картоп 50 г, қырыққабат 40 г, сәбіз 15 г, қаймақ 10 г");
const noodleSoup = soup("Үй кеспесі сорпасы", "Ұн", "Ұн 30 г, жұмыртқа 5 г, тауық сорпасы 200 г, сәбіз 10 г");
const potatoSoup = soup("Картоп сорпасы", "Картоп", "Картоп 100 г, сәбіз 15 г, пияз 10 г, өсімдік майы 5 г");

export const SCHOOL_PLAN: PlanDish[][] = [
  [chickenSoup, dish("Палау", "Сиыр еті 80 г, күріш 70 г, сәбіз 40 г, пияз 15 г, өсімдік майы 10 г"), compote],
  [vegSoup, dish("Қарақұмық ботқасымен ет котлеті", "Сиыр еті 75 г, нан 15 г, қарақұмық 60 г, пияз 10 г"), tea],
  [fishSoup, dish("Күрішпен бефстроганов", "Сиыр еті 75 г, күріш 60 г, қаймақ 15 г, пияз 10 г"), cocoa],
  [borscht, dish("Етті тұшпара", "Сиыр еті 70 г, ұн 60 г, пияз 15 г, жұмыртқа 5 г"), compote],
  [chickenSoup, dish("Макаронмен гуляш", "Сиыр еті 75 г, макарон 60 г, қызанақ пастасы 8 г, пияз 10 г"), tea],
  [noodleSoup, dish("Картоп пюресімен тефтель", "Сиыр еті 70 г, күріш 15 г, картоп 150 г, сүт 20 г"), cocoa],
  [potatoSoup, dish("Күрішпен қуырдақ", "Сиыр еті 80 г, күріш 60 г, пияз 15 г, өсімдік майы 8 г"), compote],
  [vegSoup, dish("Макаронмен ет котлеті", "Сиыр еті 75 г, нан 15 г, макарон 60 г, пияз 10 г"), tea],
  [fishSoup, dish("Палау", "Сиыр еті 80 г, күріш 70 г, сәбіз 40 г, пияз 15 г, өсімдік майы 10 г"), cocoa],
  [chickenSoup, dish("Бешбармақ", "Сиыр еті 90 г, ұн 60 г, пияз 15 г, сорпа 50 г", 250), compote],
  [borscht, dish("Қарақұмықпен тефтель", "Сиыр еті 70 г, күріш 15 г, қарақұмық 60 г"), tea],
  [noodleSoup, dish("Картоп пюресімен бефстроганов", "Сиыр еті 75 г, картоп 150 г, қаймақ 15 г, сүт 20 г"), cocoa],
  [chickenSoup, dish("Манты", "Сиыр еті 80 г, ұн 60 г, пияз 25 г, асқабақ 20 г"), compote],
  [potatoSoup, dish("Қарақұмықпен гуляш", "Сиыр еті 75 г, қарақұмық 60 г, қызанақ пастасы 8 г"), tea],
];

const milkNoodles = soup("Сүт кеспесі", "Сүт", "Сүт 150 г, кеспе 20 г, сары май 3 г, қант 5 г", 200);
const kgChicken = soup("Тауық сорпасы", "Тауық еті", "Тауық еті 35 г, картоп 50 г, кеспе 15 г, сәбіз 10 г", 200);
const kgVeg = soup("Көкөніс сорпасы", "Картоп", "Картоп 70 г, қырыққабат 30 г, сәбіз 10 г, пияз 5 г", 200);
const steamCutlet = dish("Картоп пюресімен бу котлеті", "Сиыр еті 60 г, картоп 120 г, сүт 20 г, сары май 3 г", 180);
const riceMilk = dish("Сүт күріш ботқасы", "Сүт 150 г, күріш 35 г, сары май 4 г, қант 5 г", 180, "Сүт");
const fishCutlet = dish("Күрішпен балық котлеті", "Каспий балығы 60 г, күріш 50 г, нан 10 г", 180, "Каспий балығы");
const buckwheat = dish("Етті қарақұмық ботқасы", "Сиыр еті 50 г, қарақұмық 50 г, сары май 3 г", 180);
const kgCompote: PlanDish = { ...compote, portionG: 150 };
const kgCocoa: PlanDish = { ...cocoa, portionG: 150 };

export const KINDERGARTEN_PLAN: PlanDish[][] = [
  [kgChicken, riceMilk, kgCompote],
  [kgVeg, steamCutlet, kgCocoa],
  [milkNoodles, fishCutlet, kgCompote],
  [kgChicken, buckwheat, kgCocoa],
  [kgVeg, steamCutlet, kgCompote],
  [milkNoodles, riceMilk, kgCocoa],
  [kgChicken, fishCutlet, kgCompote],
  [kgVeg, buckwheat, kgCocoa],
  [kgChicken, steamCutlet, kgCompote],
  [milkNoodles, fishCutlet, kgCocoa],
  [kgVeg, riceMilk, kgCompote],
  [kgChicken, buckwheat, kgCocoa],
  [milkNoodles, steamCutlet, kgCompote],
  [kgVeg, fishCutlet, kgCocoa],
];
