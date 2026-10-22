export const ETYPES = {
  bug: { hp: 7, spd: 58, dmg: 6, xp: 1, r: 10, col: '#7ef29a' },
  mini: { hp: 3, spd: 80, dmg: 4, xp: 1, r: 7, col: '#b7f7cf' },
  crawler: { hp: 20, spd: 44, dmg: 9, xp: 2, r: 13, col: '#e8c14a' },
  ghost: { hp: 14, spd: 68, dmg: 8, xp: 2, r: 11, col: '#9db4ff' },
  tank: { hp: 85, spd: 24, dmg: 14, xp: 5, r: 20, col: '#e8794a' },
  spawner: { hp: 55, spd: 30, dmg: 10, xp: 5, r: 16, col: '#d386e8' },
};
export const BOSSES = [
  { id: 'megabyte', name: 'МЕГАБАЙТ', hp: 2200, spd: 34, dmg: 18, r: 34, col: '#f87171' },
  { id: 'deadlock', name: 'ДЕДЛОК', hp: 4600, spd: 30, dmg: 22, r: 38, col: '#c084fc' },
  { id: 'pentestd', name: 'ПЕНТЕСТ-ДЕМОН', hp: 9500, spd: 40, dmg: 26, r: 40, col: '#fbbf24' },
  { id: 'queen', name: 'КОРОЛЕВА СПАВНОВ', hp: 17000, spd: 26, dmg: 28, r: 44, col: '#d386e8', spawner: true },
  { id: 'techdebt', name: 'ТЕХДОЛГ', hp: 32000, spd: 28, dmg: 32, r: 50, col: '#94a3b8' },
  { id: 'cluster', name: 'ГЛАВНЫЙ КЛАСТЕР', hp: 75000, spd: 24, dmg: 40, r: 62, col: '#f87171', final: true },
];
