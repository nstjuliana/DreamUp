export const GAME_TYPES = [
  { value: 'puzzle', label: 'Puzzle', description: 'Logic and strategy games' },
  { value: 'platformer', label: 'Platformer', description: 'Side-scrolling action games' },
  { value: 'idle', label: 'Idle/Clicker', description: 'Incremental progression games' },
  { value: 'shooter', label: 'Shooter', description: 'Action games with shooting mechanics' },
  { value: 'rpg', label: 'RPG', description: 'Role-playing games' },
  { value: 'other', label: 'Other', description: 'Other game types' },
] as const

export const TEST_STATUS_CONFIG = {
  pass: {
    label: 'Pass',
    color: 'green',
    bgClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  fail: {
    label: 'Fail',
    color: 'yellow',
    bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  error: {
    label: 'Error',
    color: 'red',
    bgClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  timeout: {
    label: 'Timeout',
    color: 'gray',
    bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
} as const

export const KEYBOARD_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'Escape',
  'Tab',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyZ',
  'KeyX',
  'KeyC',
  'Digit0',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
] as const

export const MOUSE_ACTIONS = ['click', 'drag', 'scroll'] as const

export const START_BUTTON_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
] as const

