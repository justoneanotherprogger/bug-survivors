export const PASSIVES = {
  dmg: { name: 'ОВЕРКЛОК', icon: '⚙️', max: 5, d: '+10% урона' },
  cd: { name: 'ОПТИМИЗАЦИЯ', icon: '⏱️', max: 5, d: '-8% перезарядки' },
  area: { name: 'РАСШИРЕНИЕ', icon: '🌐', lockAch: 'p_area', max: 5, d: '+10% площади атак' },
  proj: { name: 'РАЗГОН', icon: '🚀', lockAch: 'p_proj', max: 5, d: '+10% скорости снарядов' },
  dur: { name: 'РАДИАТОР', icon: '❄️', lockAch: 'p_dur', max: 5, d: '+12% длительности эффектов' },
  amount: { name: 'ПАРАЛЛЕЛИЗМ', icon: '🌀', lockAch: 'p_amount', max: 2, d: '+1 снаряд ко всему' },
  armor: { name: 'БРОНЯ', icon: '🧱', lockAch: 'p_armor', max: 5, d: '-1 урона от каждого удара' },
  hp: { name: 'БЕКАП', icon: '💾', lockAch: 'p_hp', max: 5, d: '+20% максимального здоровья' },
  regen: { name: 'РЕГЕНЕРАЦИЯ', icon: '💗', lockAch: 'p_regen', max: 5, d: '+0.25 HP/сек' },
  mspd: { name: 'КРОССЫ', icon: '👟', lockAch: 'p_mspd', max: 5, d: '+7% скорости бега' },
  magnet: { name: 'МАГНИТ', icon: '🧲', lockAch: 'p_magnet', max: 5, d: '+25% радиуса подбора' },
  luck: { name: 'УДАЧА', icon: '🍀', lockAch: 'p_luck', max: 5, d: '+10% шанса дропа и лут-боксов' },
  growth: { name: 'КУРСЫ', icon: '📈', lockAch: 'p_growth', max: 5, d: '+8% получаемого опыта' },
  spag: {
    name: 'СПАГЕТТИ-КОД',
    icon: '🍝',
    lockAch: 'p_spag',
    max: 100,
    d: 'баги плодятся и крепнут: за уровень +10% спавна, +16% HP, +6% их скорости (множатся). добыча и прокачка — ТОЛЬКО из сундуков (шанс растёт с числом убийств), слоты пассивок не занимает',
  },
};

/* ключевой стат оружия для модов (бесконечные микро-бонусы после ур. 8) */
export const KEYSTATS = {
  whip: 'area',
  knife: 'speed',
  orbit: 'area',
  tesla: 'cd',
  aura: 'area',
  axe: 'area',
  boom: 'speed',
  flask: 'dur',
  laser: 'cd',
  fire: 'speed',
  drone: 'dmg',
  shur: 'speed',
  xbow: 'dmg',
  saw: 'area',
  mortar: 'area',
  mines: 'dur',
};
export const MODTXT = {
  dmg: '+9% урона этого оружия',
  area: '+5% площади и +3% урона этого оружия',
  cd: '−2.5% кулдауна и +3% урона этого оружия',
  speed: '+5% скорости ПОЛЁТА снарядов этого оружия (не бега героя) и +3% урона',
  dur: '+8% длительности и +3% урона этого оружия',
};
